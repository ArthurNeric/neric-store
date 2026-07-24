-- ============================================================================
-- Neric Store — recipes (bill of materials) + sale reversal
-- Links menu items to the inventory ingredients they consume, deducts them
-- atomically inside create_order(), and adds void_order() to reverse both
-- the order AND its inventory deduction atomically — replacing the client's
-- previous direct `delete` on orders (that policy is dropped below so the
-- reversal can no longer be bypassed).
-- ============================================================================

-- ---------------------------------------------------------- product_recipes
-- One row per ingredient a product consumes. qty_per_unit is always
-- expressed in that ingredient's OWN inventory_items.unit — there is no
-- automatic g<->kg (or any other) conversion. If Potatoes are tracked in kg,
-- a Fries recipe entry of 0.15 means "150g per fries sold, expressed as
-- 0.15kg". This sidesteps a unit-conversion subsystem that couldn't fully
-- work anyway, since inventory_items.unit allows arbitrary custom units
-- ("sachet", "tray", ...) with no numeric relationship to grams.
create table public.product_recipes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  qty_per_unit numeric(12, 4) not null check (qty_per_unit > 0),
  created_at timestamptz not null default now(),
  unique (product_id, inventory_item_id)
);

create index product_recipes_product_id_idx on public.product_recipes (product_id);

alter table public.product_recipes enable row level security;

-- Same openness as products/inventory_items — recipes are catalog
-- configuration, not sensitive data, and both roles already share full
-- Menu/Inventory edit rights.
create policy "product recipes readable by authenticated"
  on public.product_recipes for select to authenticated using (true);
create policy "product recipes insertable by authenticated"
  on public.product_recipes for insert to authenticated with check (true);
create policy "product recipes updatable by authenticated"
  on public.product_recipes for update to authenticated using (true) with check (true);
create policy "product recipes deletable by authenticated"
  on public.product_recipes for delete to authenticated using (true);

-- ------------------------------------------ inventory_transactions, signed
-- Was restock-only (qty_added, always positive). Sale deductions and their
-- reversals now log through the same table, so "Added history" becomes a
-- true signed stock-activity feed instead of a restock-only log.
alter table public.inventory_transactions rename column qty_added to qty_delta;
alter table public.inventory_transactions drop constraint inventory_transactions_qty_added_check;
alter table public.inventory_transactions add constraint inventory_transactions_qty_delta_check check (qty_delta <> 0);
alter table public.inventory_transactions add column reason text not null default 'restock'
  check (reason in ('restock', 'sale', 'sale_reversal'));

-- ============================================================================
-- RPC: add_inventory_stock — unchanged behavior, updated for the qty_delta
-- rename and explicit reason.
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
-- RPC: create_order — now also deducts every sold item's recipe ingredients
-- in the same atomic transaction as the order itself. Orders whose items
-- have no product_id, or whose product has no recipe rows, simply touch no
-- inventory — unchanged from today's behavior. No stock-sufficiency check:
-- a sale always completes; an ingredient can go negative as a visible
-- "restock now" signal (confirmed product decision).
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
-- RPC: void_order — the actual "undo a mistaken sale" action. Reverses every
-- recipe-driven deduction the order made, then deletes the order (cascades
-- to order_items exactly as the old direct delete did). Both happen in one
-- transaction: inventory can never be restored without the order actually
-- disappearing, or vice versa.
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

-- Direct delete is no longer the sanctioned path — void_order() is, so the
-- reversal can't be silently skipped by some other code path deleting an
-- order directly. void_order() is security definer, so it still works.
drop policy "orders deletable by authenticated" on public.orders;

-- ============================================================================
-- RPC: save_product_recipe — atomic replace-all for one product's recipe
-- rows, so the Menu editor's "Ingredients" section is one round trip instead
-- of a manual delete-then-insert from the client. Runs as the caller (no
-- security definer) — product_recipes' RLS already permits this directly,
-- the RPC exists purely for atomicity, not elevated privilege.
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
