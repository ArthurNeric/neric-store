-- ============================================================================
-- Neric Store — repair/complete migration 0003
-- 0003_product_recipes.sql appears to have partially applied (product_recipes
-- exists, but save_product_recipe() — and possibly other pieces — did not).
-- Every statement here is written to be safe to run regardless of what
-- already landed: CREATE TABLE/INDEX use IF NOT EXISTS, policies are
-- dropped-then-recreated, ALTER TABLE column/constraint changes are guarded
-- by existence checks, and every function is CREATE OR REPLACE (always
-- idempotent). Running this after 0003 fully succeeded is a harmless no-op.
-- ============================================================================

-- ---------------------------------------------------------- product_recipes
create table if not exists public.product_recipes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  qty_per_unit numeric(12, 4) not null check (qty_per_unit > 0),
  created_at timestamptz not null default now(),
  unique (product_id, inventory_item_id)
);

create index if not exists product_recipes_product_id_idx on public.product_recipes (product_id);

alter table public.product_recipes enable row level security;

drop policy if exists "product recipes readable by authenticated" on public.product_recipes;
create policy "product recipes readable by authenticated"
  on public.product_recipes for select to authenticated using (true);

drop policy if exists "product recipes insertable by authenticated" on public.product_recipes;
create policy "product recipes insertable by authenticated"
  on public.product_recipes for insert to authenticated with check (true);

drop policy if exists "product recipes updatable by authenticated" on public.product_recipes;
create policy "product recipes updatable by authenticated"
  on public.product_recipes for update to authenticated using (true) with check (true);

drop policy if exists "product recipes deletable by authenticated" on public.product_recipes;
create policy "product recipes deletable by authenticated"
  on public.product_recipes for delete to authenticated using (true);

-- ------------------------------------------ inventory_transactions, signed
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inventory_transactions' and column_name = 'qty_added'
  ) then
    alter table public.inventory_transactions rename column qty_added to qty_delta;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'inventory_transactions'
      and constraint_name = 'inventory_transactions_qty_added_check'
  ) then
    alter table public.inventory_transactions drop constraint inventory_transactions_qty_added_check;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'inventory_transactions'
      and constraint_name = 'inventory_transactions_qty_delta_check'
  ) then
    alter table public.inventory_transactions
      add constraint inventory_transactions_qty_delta_check check (qty_delta <> 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inventory_transactions' and column_name = 'reason'
  ) then
    alter table public.inventory_transactions add column reason text not null default 'restock'
      check (reason in ('restock', 'sale', 'sale_reversal'));
  end if;
end $$;

-- ============================================================================
-- RPC: add_inventory_stock
-- ============================================================================

create or replace function public.add_inventory_stock(
  p_item_id uuid,
  p_qty numeric
)
returns public.inventory_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.inventory_items;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'quantity to add must be greater than zero';
  end if;

  update public.inventory_items
  set qty = qty + p_qty
  where id = p_item_id
  returning * into v_item;

  if v_item.id is null then
    raise exception 'inventory item % not found', p_item_id;
  end if;

  insert into public.inventory_transactions (item_id, item_name, emoji, unit, qty_delta, reason, created_by)
  values (v_item.id, v_item.name, v_item.emoji, v_item.unit, p_qty, 'restock', auth.uid());

  return v_item;
end;
$$;

grant execute on function public.add_inventory_stock(uuid, numeric) to authenticated;

-- ============================================================================
-- RPC: create_order
-- ============================================================================

create or replace function public.create_order(
  p_payment_method text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number bigint;
  v_total numeric(12, 2);
  v_created_at timestamptz;
begin
  if p_payment_method not in ('Cash', 'GCash') then
    raise exception 'invalid payment method: %', p_payment_method;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order must contain at least one item';
  end if;

  select coalesce(sum((item ->> 'price')::numeric * (item ->> 'qty')::numeric), 0)
  into v_total
  from jsonb_array_elements(p_items) as item;

  update public.order_counters
  set next_number = next_number + 1
  where id = true
  returning next_number - 1 into v_order_number;

  insert into public.orders (order_number, total, payment_method, created_by)
  values (v_order_number, v_total, p_payment_method, auth.uid())
  returning id, created_at into v_order_id, v_created_at;

  insert into public.order_items (order_id, product_id, name, category, price, cost, qty, emoji)
  select
    v_order_id,
    nullif(item ->> 'product_id', '')::uuid,
    item ->> 'name',
    item ->> 'category',
    (item ->> 'price')::numeric,
    coalesce((item ->> 'cost')::numeric, 0),
    (item ->> 'qty')::numeric,
    item ->> 'emoji'
  from jsonb_array_elements(p_items) as item;

  with sold as (
    select oi.product_id, oi.qty
    from public.order_items oi
    where oi.order_id = v_order_id and oi.product_id is not null
  ),
  usage as (
    select pr.inventory_item_id, sum(sold.qty * pr.qty_per_unit) as total_qty
    from sold
    join public.product_recipes pr on pr.product_id = sold.product_id
    group by pr.inventory_item_id
  ),
  updated as (
    update public.inventory_items ii
    set qty = ii.qty - usage.total_qty
    from usage
    where ii.id = usage.inventory_item_id
    returning ii.id, ii.name, ii.emoji, ii.unit, usage.total_qty
  )
  insert into public.inventory_transactions (item_id, item_name, emoji, unit, qty_delta, reason, created_by)
  select id, name, emoji, unit, -total_qty, 'sale', auth.uid()
  from updated;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'total', v_total,
    'payment_method', p_payment_method,
    'created_at', v_created_at
  );
end;
$$;

grant execute on function public.create_order(text, jsonb) to authenticated;

-- ============================================================================
-- RPC: void_order
-- ============================================================================

create or replace function public.void_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.orders where id = p_order_id) then
    raise exception 'order % not found', p_order_id;
  end if;

  with sold as (
    select oi.product_id, oi.qty
    from public.order_items oi
    where oi.order_id = p_order_id and oi.product_id is not null
  ),
  usage as (
    select pr.inventory_item_id, sum(sold.qty * pr.qty_per_unit) as total_qty
    from sold
    join public.product_recipes pr on pr.product_id = sold.product_id
    group by pr.inventory_item_id
  ),
  updated as (
    update public.inventory_items ii
    set qty = ii.qty + usage.total_qty
    from usage
    where ii.id = usage.inventory_item_id
    returning ii.id, ii.name, ii.emoji, ii.unit, usage.total_qty
  )
  insert into public.inventory_transactions (item_id, item_name, emoji, unit, qty_delta, reason, created_by)
  select id, name, emoji, unit, total_qty, 'sale_reversal', auth.uid()
  from updated;

  delete from public.orders where id = p_order_id;
end;
$$;

grant execute on function public.void_order(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'orders' and policyname = 'orders deletable by authenticated') then
    drop policy "orders deletable by authenticated" on public.orders;
  end if;
end $$;

-- ============================================================================
-- RPC: save_product_recipe — the one that was missing.
-- ============================================================================

create or replace function public.save_product_recipe(p_product_id uuid, p_recipe jsonb)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.product_recipes where product_id = p_product_id;

  insert into public.product_recipes (product_id, inventory_item_id, qty_per_unit)
  select
    p_product_id,
    (item ->> 'inventory_item_id')::uuid,
    (item ->> 'qty_per_unit')::numeric
  from jsonb_array_elements(coalesce(p_recipe, '[]'::jsonb)) as item
  where coalesce((item ->> 'qty_per_unit')::numeric, 0) > 0;
end;
$$;

grant execute on function public.save_product_recipe(uuid, jsonb) to authenticated;

-- ============================================================================
-- Realtime publication
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'device_sessions'
  ) then
    alter publication supabase_realtime add table public.device_sessions;
  end if;
end $$;

notify pgrst, 'reload schema';
