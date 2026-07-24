-- ============================================================================
-- Neric Store — contact email (reference only, not used for login)
-- Adds a plain contact-email field per account, purely for record-keeping in
-- the Accounts screen. Login stays exactly as it is today — username maps to
-- a fixed internal placeholder email via usernameToEmail(), computed
-- instantly on the frontend with no lookup. This does NOT touch that.
--
-- profiles has no UPDATE policy at all today (deliberately — every existing
-- profile change goes through the admin-reset-credentials Edge Function,
-- which uses the service-role key). Rather than open a general "authenticated
-- can update profiles" policy — which would let a signed-in user rewrite
-- their own role/username too — this adds one narrow RPC that can only ever
-- touch the contact_email column, for the caller's own row or an admin
-- editing anyone's.
-- ============================================================================

alter table public.profiles add column if not exists contact_email text;

create or replace function public.update_contact_email(p_profile_id uuid, p_contact_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();

  if auth.uid() <> p_profile_id and coalesce(v_caller_role, '') <> 'admin' then
    raise exception 'not allowed';
  end if;

  update public.profiles
  set contact_email = nullif(trim(p_contact_email), '')
  where id = p_profile_id;
end;
$$;

grant execute on function public.update_contact_email(uuid, text) to authenticated;
