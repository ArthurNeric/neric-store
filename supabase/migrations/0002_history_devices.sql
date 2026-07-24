-- ============================================================================
-- Neric Store — admin history + device sessions
-- Adds: an admin-only audit trail of new menu/inventory items (7-day rolling
-- window), and a device_sessions table backing per-role device limits, idle-
-- adjacent forced logout, and the admin "force logout" button. Also adds
-- `orders` and `device_sessions` to the realtime publication so the Sales
-- History tab and the device-revocation watcher get push updates instead of
-- polling.
-- ============================================================================

-- ------------------------------------------------------------ activity_log
-- One row per *creation* of a product or inventory item (not edits/deletes —
-- literal ask was "history of adding new items"). Populated by a trigger, not
-- a client-side insert call, so it can never be silently skipped by a code
-- path that forgets to log it.
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('product', 'inventory_item')),
  entity_id uuid,
  entity_name text not null,
  entity_emoji text,
  action text not null default 'created' check (action in ('created', 'updated', 'deleted')),
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index activity_log_created_at_idx on public.activity_log (created_at desc);

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log (entity_type, entity_id, entity_name, entity_emoji, actor_id)
  values (tg_argv[0], new.id, new.name, new.emoji, auth.uid());
  return new;
end;
$$;

create trigger products_log_activity
  after insert on public.products
  for each row execute function public.log_activity('product');

create trigger inventory_items_log_activity
  after insert on public.inventory_items
  for each row execute function public.log_activity('inventory_item');

-- First admin-only table in this app. Every other table so far is
-- `to authenticated using (true))` — this one actually restricts by role.
alter table public.activity_log enable row level security;

create policy "activity log readable by admin"
  on public.activity_log for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- No insert/update/delete policy exists, so RLS already blocks writes from
-- anon/authenticated by default — revoked explicitly anyway, matching the
-- defensive style already used for order_counters below.
revoke insert, update, delete on public.activity_log from anon, authenticated;

-- ------------------------------------------------------------ device_sessions
-- One row per login. register_device_session() (called once per real sign-in,
-- never on page reload) inserts a row then revokes the oldest excess rows
-- beyond that role's device limit. An admin's "force logout" button is just
-- an UPDATE permitted by the policy below — no Edge Function needed.
create table public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  device_label text not null default 'Unknown device',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked boolean not null default false,
  revoked_at timestamptz
);

create index device_sessions_user_id_idx
  on public.device_sessions (user_id, revoked, last_seen_at desc);

alter table public.device_sessions enable row level security;

create policy "device sessions readable by owner or admin"
  on public.device_sessions for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "device sessions updatable by owner or admin"
  on public.device_sessions for update to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Rows are only ever created through the RPC below (security definer), never
-- a direct client insert — same "no client, not even an admin, can write it
-- directly" shape as order_counters.
revoke insert, delete on public.device_sessions from anon, authenticated;

-- ============================================================================
-- RPC: register_device_session — called once per real sign-in (never on page
-- reload/token refresh). Inserts the new session row, then revokes the
-- oldest non-revoked rows beyond the caller's role limit (2 for admin, 3 for
-- staff), keeping the most-recently-active ones. The just-inserted row always
-- has the freshest last_seen_at, so it can never revoke itself.
-- ============================================================================

create or replace function public.register_device_session(p_device_label text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_new_id uuid;
  v_limit int;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then
    raise exception 'no profile found for the current user';
  end if;

  v_limit := case when v_role = 'admin' then 2 else 3 end;

  insert into public.device_sessions (user_id, role, device_label)
  values (auth.uid(), v_role, coalesce(nullif(trim(p_device_label), ''), 'Unknown device'))
  returning id into v_new_id;

  with alive as (
    select id
    from public.device_sessions
    where user_id = auth.uid() and revoked = false
    order by last_seen_at desc
    offset v_limit
  )
  update public.device_sessions
  set revoked = true, revoked_at = now()
  where id in (select id from alive);

  return v_new_id;
end;
$$;

grant execute on function public.register_device_session(text) to authenticated;

-- ============================================================================
-- Realtime — Sales History (orders) and the device-revocation watcher both
-- need push updates. Guarded with existence checks so this migration is safe
-- to re-run and doesn't error if a table is already published.
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
