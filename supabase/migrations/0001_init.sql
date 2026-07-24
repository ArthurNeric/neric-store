-- ============================================================================
-- Neric Store — initial schema
-- Single-store deployment. Every mock array from the old bundle becomes a
-- real table here; the fake analytics object becomes report_summary().
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------- profiles
-- One row per Supabase Auth user. Populated automatically by the trigger
-- below whenever an account is created (see scripts/seed.mjs).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('staff', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'staff')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Fries',
  price numeric(10, 2) not null check (price >= 0),
  cost numeric(10, 2) not null default 0 check (cost >= 0),
  emoji text not null default '🍽️',
  image_url text,
  is_favorite boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------- inventory items
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'count',
  qty numeric(12, 3) not null default 0,
  cost numeric(10, 2) not null default 0,
  emoji text not null default '📦',
  created_at timestamptz not null default now()
);

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.inventory_items (id) on delete set null,
  item_name text not null,
  emoji text not null default '📦',
  unit text not null default 'count',
  qty_added numeric(12, 3) not null check (qty_added > 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index inventory_transactions_created_at_idx
  on public.inventory_transactions (created_at desc);

-- --------------------------------------------------------------- order flow
-- A single-row counter table gives every order an atomic, gap-free number
-- even when two devices check out at the same moment. It is only ever
-- touched from inside create_order() (SECURITY DEFINER) — no client, not
-- even an admin, can read or write it directly.
create table public.order_counters (
  id boolean primary key default true,
  next_number bigint not null default 1,
  constraint order_counters_singleton check (id)
);
insert into public.order_counters (id, next_number) values (true, 1)
  on conflict (id) do nothing;
revoke all on public.order_counters from anon, authenticated;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint not null unique,
  total numeric(12, 2) not null check (total >= 0),
  payment_method text not null check (payment_method in ('Cash', 'GCash')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  category text,
  price numeric(10, 2) not null,
  cost numeric(10, 2) not null default 0,
  qty numeric(10, 2) not null,
  emoji text
);

create index orders_created_at_idx on public.orders (created_at desc);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_name_idx on public.order_items (name);

-- ============================================================================
-- Row Level Security
-- Single store, both roles (staff/admin) share full CRUD on the catalog and
-- inventory in the current UI (the Menu/Inventory screens are the exact same
-- component whether opened from the Worker or Admin dashboard). The only
-- hard privilege boundary in the product is "Accounts → Reset login", which
-- is enforced server-side in the admin-reset-credentials Edge Function, not
-- here — it needs the service-role key, which RLS can't grant.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "profiles readable by authenticated"
  on public.profiles for select to authenticated using (true);

create policy "products readable by authenticated"
  on public.products for select to authenticated using (true);
create policy "products insertable by authenticated"
  on public.products for insert to authenticated with check (true);
create policy "products updatable by authenticated"
  on public.products for update to authenticated using (true) with check (true);
create policy "products deletable by authenticated"
  on public.products for delete to authenticated using (true);

create policy "inventory items readable by authenticated"
  on public.inventory_items for select to authenticated using (true);
create policy "inventory items insertable by authenticated"
  on public.inventory_items for insert to authenticated with check (true);
create policy "inventory items updatable by authenticated"
  on public.inventory_items for update to authenticated using (true) with check (true);
create policy "inventory items deletable by authenticated"
  on public.inventory_items for delete to authenticated using (true);

create policy "inventory transactions readable by authenticated"
  on public.inventory_transactions for select to authenticated using (true);
create policy "inventory transactions insertable by authenticated"
  on public.inventory_transactions for insert to authenticated with check (true);

-- Orders can be read and removed by any signed-in staff/admin (matches the
-- Worker "Today" tab's Remove button in the original UI), but can only ever
-- be *created* through create_order() below — never a raw INSERT — so the
-- total and order_number are always server-computed and trustworthy.
create policy "orders readable by authenticated"
  on public.orders for select to authenticated using (true);
create policy "orders deletable by authenticated"
  on public.orders for delete to authenticated using (true);

create policy "order items readable by authenticated"
  on public.order_items for select to authenticated using (true);

-- ============================================================================
-- Storage — product photos (replaces base64-in-state image uploads)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "authenticated can upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');

create policy "authenticated can replace product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images');

create policy "authenticated can delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images');

-- ============================================================================
-- RPC: create_order — atomic checkout
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
-- RPC: report_summary — real replacement for the old hardcoded `Sj` object.
-- Returns the shape the Overview/Reports screens expect:
-- { caption, prev, revenue, cost, profit, margin, orders, delta, oDelta,
--   gcash, series, top }, computed live from orders/order_items. Cost and
-- profit are real (sum of each sold item's cost snapshot), not the fake
-- fixed 44%-of-revenue estimate the original mock used. All bucketing is
-- done in Asia/Manila local time (this is a PH storefront) and empty
-- buckets report 0 instead of being missing, via generate_series.
-- ============================================================================

create or replace function public.report_summary(p_range text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_now timestamp := (now() at time zone 'Asia/Manila');
  v_period_start timestamp;
  v_period_end timestamp;
  v_prev_start timestamp;
  v_prev_end timestamp;
  v_caption text;
  v_prev_label text;
  v_series jsonb;
  v_top jsonb;
  v_revenue numeric(14, 2);
  v_cost numeric(14, 2);
  v_orders_count bigint;
  v_prev_revenue numeric(14, 2);
  v_prev_orders_count bigint;
  v_gcash_pct numeric;
  v_delta numeric;
  v_odelta numeric;
  v_first_order timestamp;
begin
  if p_range = '24h' then
    v_period_start := date_trunc('day', v_local_now);
    v_period_end := v_period_start + interval '1 day';
    v_prev_start := v_period_start - interval '1 day';
    v_prev_end := v_period_start;
    v_caption := 'Today';
    v_prev_label := 'vs yesterday';

    select coalesce(jsonb_agg(jsonb_build_object('x', trim(leading '0' from to_char(h, 'HH12am')), 'v', coalesce(s.total, 0)) order by h), '[]'::jsonb)
    into v_series
    from generate_series(v_period_start, date_trunc('hour', v_local_now), interval '1 hour') as h
    left join (
      select date_trunc('hour', created_at at time zone 'Asia/Manila') as bucket, sum(total) as total
      from public.orders
      where (created_at at time zone 'Asia/Manila') >= v_period_start
        and (created_at at time zone 'Asia/Manila') < v_period_end
      group by 1
    ) s on s.bucket = h;

  elsif p_range = '7d' then
    v_period_start := date_trunc('day', v_local_now) - interval '6 days';
    v_period_end := date_trunc('day', v_local_now) + interval '1 day';
    v_prev_start := v_period_start - interval '7 days';
    v_prev_end := v_period_start;
    v_caption := to_char(v_period_start, 'Mon DD') || ' – ' || to_char(v_period_end - interval '1 day', 'Mon DD');
    v_prev_label := 'vs last week';

    select coalesce(jsonb_agg(jsonb_build_object('x', to_char(d, 'Dy'), 'v', coalesce(s.total, 0)) order by d), '[]'::jsonb)
    into v_series
    from generate_series(v_period_start, v_period_end - interval '1 day', interval '1 day') as d
    left join (
      select date_trunc('day', created_at at time zone 'Asia/Manila') as bucket, sum(total) as total
      from public.orders
      where (created_at at time zone 'Asia/Manila') >= v_period_start
        and (created_at at time zone 'Asia/Manila') < v_period_end
      group by 1
    ) s on s.bucket = d;

  elsif p_range = '30d' then
    v_period_start := date_trunc('day', v_local_now) - interval '29 days';
    v_period_end := date_trunc('day', v_local_now) + interval '1 day';
    v_prev_start := v_period_start - interval '30 days';
    v_prev_end := v_period_start;
    v_caption := to_char(v_period_start, 'Mon DD') || ' – ' || to_char(v_period_end - interval '1 day', 'Mon DD');
    v_prev_label := 'vs previous 30 days';

    with days as (
      select date_trunc('day', created_at at time zone 'Asia/Manila') as day, total
      from public.orders
      where (created_at at time zone 'Asia/Manila') >= v_period_start
        and (created_at at time zone 'Asia/Manila') < v_period_end
    ),
    bucketed as (
      select (1 + floor(extract(day from (day - v_period_start)) / 6))::int as idx, total
      from days
    )
    select coalesce(jsonb_agg(jsonb_build_object('x', 'W' || gs.idx, 'v', coalesce(b.total, 0)) order by gs.idx), '[]'::jsonb)
    into v_series
    from generate_series(1, 5) as gs (idx)
    left join (select idx, sum(total) as total from bucketed group by idx) b on b.idx = gs.idx;

  elsif p_range = '12m' then
    v_period_start := date_trunc('month', v_local_now) - interval '11 months';
    v_period_end := date_trunc('month', v_local_now) + interval '1 month';
    v_prev_start := v_period_start - interval '12 months';
    v_prev_end := v_period_start;
    v_caption := to_char(v_period_start, 'Mon YYYY') || ' – ' || to_char(v_period_end - interval '1 month', 'Mon YYYY');
    v_prev_label := 'vs previous year';

    select coalesce(jsonb_agg(jsonb_build_object('x', to_char(m, 'Mon'), 'v', coalesce(s.total, 0)) order by m), '[]'::jsonb)
    into v_series
    from generate_series(v_period_start, v_period_end - interval '1 month', interval '1 month') as m
    left join (
      select date_trunc('month', created_at at time zone 'Asia/Manila') as bucket, sum(total) as total
      from public.orders
      where (created_at at time zone 'Asia/Manila') >= v_period_start
        and (created_at at time zone 'Asia/Manila') < v_period_end
      group by 1
    ) s on s.bucket = m;

  elsif p_range = 'all' then
    select min(created_at at time zone 'Asia/Manila') into v_first_order from public.orders;
    v_period_start := date_trunc('year', coalesce(v_first_order, v_local_now));
    v_period_end := date_trunc('year', v_local_now) + interval '1 year';
    v_prev_start := null;
    v_prev_end := null;
    v_caption := case when v_first_order is null then 'No sales yet' else 'Since ' || to_char(v_first_order, 'Mon YYYY') end;
    v_prev_label := 'lifetime';

    select coalesce(jsonb_agg(jsonb_build_object('x', to_char(y, 'YYYY'), 'v', coalesce(s.total, 0)) order by y), '[]'::jsonb)
    into v_series
    from generate_series(v_period_start, v_period_end - interval '1 year', interval '1 year') as y
    left join (
      select date_trunc('year', created_at at time zone 'Asia/Manila') as bucket, sum(total) as total
      from public.orders
      group by 1
    ) s on s.bucket = y;

  else
    raise exception 'invalid range: %', p_range;
  end if;

  select coalesce(sum(total), 0), coalesce(count(*), 0)
  into v_revenue, v_orders_count
  from public.orders
  where (created_at at time zone 'Asia/Manila') >= v_period_start
    and (created_at at time zone 'Asia/Manila') < v_period_end;

  select coalesce(sum(oi.qty * oi.cost), 0)
  into v_cost
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where (o.created_at at time zone 'Asia/Manila') >= v_period_start
    and (o.created_at at time zone 'Asia/Manila') < v_period_end;

  select coalesce(sum(total), 0), coalesce(count(*), 0)
  into v_prev_revenue, v_prev_orders_count
  from public.orders
  where v_prev_start is not null
    and (created_at at time zone 'Asia/Manila') >= v_prev_start
    and (created_at at time zone 'Asia/Manila') < v_prev_end;

  select coalesce(round(100 * sum(case when payment_method = 'GCash' then total else 0 end) / nullif(sum(total), 0)), 0)
  into v_gcash_pct
  from public.orders
  where (created_at at time zone 'Asia/Manila') >= v_period_start
    and (created_at at time zone 'Asia/Manila') < v_period_end;

  if v_prev_start is not null and v_prev_revenue > 0 then
    v_delta := round(((v_revenue - v_prev_revenue) / v_prev_revenue) * 100, 1);
  else
    v_delta := null;
  end if;

  if v_prev_start is not null and v_prev_orders_count > 0 then
    v_odelta := round(((v_orders_count - v_prev_orders_count)::numeric / v_prev_orders_count) * 100, 1);
  else
    v_odelta := null;
  end if;

  select coalesce(jsonb_agg(t), '[]'::jsonb)
  into v_top
  from (
    select oi.name, sum(oi.qty) as sold, sum(oi.qty * oi.price) as rev
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where (o.created_at at time zone 'Asia/Manila') >= v_period_start
      and (o.created_at at time zone 'Asia/Manila') < v_period_end
    group by oi.name
    order by sold desc
    limit 4
  ) t;

  return jsonb_build_object(
    'caption', v_caption,
    'prev', v_prev_label,
    'revenue', v_revenue,
    'cost', v_cost,
    'profit', v_revenue - v_cost,
    'margin', case when v_revenue > 0 then round(((v_revenue - v_cost) / v_revenue) * 100) else 0 end,
    'orders', v_orders_count,
    'delta', v_delta,
    'oDelta', v_odelta,
    'gcash', v_gcash_pct,
    'series', v_series,
    'top', v_top
  );
end;
$$;

grant execute on function public.report_summary(text) to authenticated;

-- ============================================================================
-- RPC: add_inventory_stock — atomic "Add stock" action.
-- Bumps inventory_items.qty and writes the matching inventory_transactions
-- history row in one round trip, so two people restocking the same item at
-- the same moment can never clobber each other's read-modify-write.
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

  insert into public.inventory_transactions (item_id, item_name, emoji, unit, qty_added, created_by)
  values (v_item.id, v_item.name, v_item.emoji, v_item.unit, p_qty, auth.uid());

  return v_item;
end;
$$;

grant execute on function public.add_inventory_stock(uuid, numeric) to authenticated;
