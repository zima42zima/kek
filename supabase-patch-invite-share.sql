-- MISAO invite sharing — peek inviter at gate + auto-follow on claim
-- Run after supabase-patch-onboarding.sql. Safe to re-run.

-- Gate: valid unused code → inviter display name (no email, no used-code leak)
create or replace function public.peek_invite(p_code text)
returns table (
  valid boolean,
  inviter_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    true as valid,
    coalesce(p.silly_name, 'a fren') as inviter_name
  from public.invites i
  left join public.profiles p on p.id = i.created_by
  where upper(trim(i.code)) = upper(trim(p_code))
    and i.used_by is null
  limit 1;
$$;

-- Claim invite + quietly follow the fren who invited you
create or replace function public.claim_invite(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inviter uuid;
  ok boolean;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if trim(coalesce(p_code, '')) = '' then
    return false;
  end if;

  if public.signup_gate_open() then
    return true;
  end if;

  update public.invites
  set used_by = uid, used_at = now()
  where upper(trim(code)) = upper(trim(p_code))
    and used_by is null
  returning created_by into inviter;

  ok := found;

  if ok and inviter is not null and inviter <> uid then
    begin
      perform public.follow_user(inviter);
    exception
      when undefined_function then null;
      when others then null;
    end;
  end if;

  return ok;
end;
$$;

-- Soft cap: max 10 unused codes per fren
create or replace function public.create_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_code text;
  unused int;
  tries int := 0;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select count(*)::int into unused
  from public.invites
  where created_by = uid and used_by is null;

  if unused >= 10 then
    raise exception 'You have 10 unused invite codes already. Share one first.';
  end if;

  if (
    select count(*)::int
    from public.invites
    where created_by = uid
      and created_at > now() - interval '24 hours'
  ) >= 3 then
    raise exception 'Daily invite limit reached (3 per 24 hours). Try again later.';
  end if;

  loop
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.invites i where i.code = new_code);
    tries := tries + 1;
    if tries > 25 then
      raise exception 'Could not generate invite code';
    end if;
  end loop;

  insert into public.invites (code, created_by)
  values (new_code, uid);

  return new_code;
end;
$$;

grant execute on function public.peek_invite(text) to anon, authenticated;

notify pgrst, 'reload schema';
