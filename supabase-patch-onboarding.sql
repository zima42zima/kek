-- MISAO onboarding — invite gate + unique fren names
-- Run in Supabase → SQL Editor after supabase-fix-profile-permissions.sql
-- Safe to re-run.

-- Ensure invites table exists (fresh projects)
create table if not exists public.invites (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  created_by uuid references auth.users on delete set null,
  used_by uuid references auth.users on delete set null,
  created_at timestamptz default now(),
  used_at timestamptz
);

alter table public.invites enable row level security;

-- Dedupe silly_names before unique index (safe if already unique)
with ranked as (
  select
    id,
    silly_name,
    row_number() over (
      partition by lower(trim(silly_name))
      order by created_at nulls last, id
    ) as rn
  from public.profiles
  where trim(coalesce(silly_name, '')) <> ''
)
update public.profiles p
set silly_name = ranked.silly_name || '_' || substr(replace(p.id::text, '-', ''), 1, 4)
from ranked
where p.id = ranked.id
  and ranked.rn > 1;

-- Case-insensitive unique fren names (silly_name)
drop index if exists public.profiles_silly_name_lower_uniq;
create unique index profiles_silly_name_lower_uniq
  on public.profiles (lower(trim(silly_name)))
  where trim(silly_name) <> '' and lower(trim(silly_name)) <> 'nameless fren';

-- First-ever signup can skip invite when no profiles exist yet
create or replace function public.signup_gate_open()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (select 1 from public.profiles limit 1);
$$;

-- Gate check: is this invite code unused?
create or replace function public.validate_invite(p_code text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.invites
    where upper(trim(code)) = upper(trim(p_code))
      and used_by is null
  );
$$;

-- Gate peek: unused code only → inviter display name (no email)
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

-- Atomically claim an invite after signup (one winner per code) + follow inviter
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

-- Is this fren name free? Optional exclude user (for profile edits)
create or replace function public.check_fren_name_available(p_name text, p_exclude_user uuid default null)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when trim(coalesce(p_name, '')) = '' then false
    when lower(trim(p_name)) in ('nameless fren', 'frens', 'admin', 'founder', 'anonymous', 'null') then false
    else not exists (
      select 1
      from public.profiles
      where lower(trim(silly_name)) = lower(trim(p_name))
        and (p_exclude_user is null or id <> p_exclude_user)
    )
  end;
$$;

-- Daily quota: 3 new codes per rolling 24 hours
create or replace function public.get_invite_daily_quota()
returns table (
  daily_limit int,
  created_last_24h int,
  remaining int,
  resets_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
  lim int := 3;
  cnt int;
  oldest timestamptz;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select count(*)::int into cnt
  from public.invites
  where created_by = uid
    and created_at > now() - interval '24 hours';

  cnt := coalesce(cnt, 0);

  if cnt >= lim then
    select min(i.created_at) into oldest
    from (
      select created_at
      from public.invites
      where created_by = uid
        and created_at > now() - interval '24 hours'
      order by created_at asc
      limit lim
    ) i;

    return query select lim, cnt, 0, oldest + interval '24 hours';
    return;
  end if;

  return query select lim, cnt, lim - cnt, null::timestamptz;
end;
$$;

-- Generate a fresh invite code for the signed-in fren
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

-- List invites created by the current user
create or replace function public.list_my_invites()
returns table (
  code text,
  used_by uuid,
  created_at timestamptz,
  used_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select i.code, i.used_by, i.created_at, i.used_at
  from public.invites i
  where i.created_by = auth.uid()
  order by i.created_at desc
  limit 50;
$$;

-- Enforce unique names on profile save
create or replace function public.upsert_my_profile(
  p_silly_name text default null,
  p_one_human_thing text default null,
  p_bio text default null,
  p_avatar_url text default null,
  p_avatar_type text default null,
  p_share_location boolean default null,
  p_is_founder boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_name text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  clean_name := nullif(trim(p_silly_name), '');

  if clean_name is not null then
    if lower(clean_name) in ('frens', 'admin', 'founder', 'anonymous', 'null') then
      raise exception 'That fren name is reserved.';
    end if;
    if exists (
      select 1 from public.profiles p
      where lower(trim(p.silly_name)) = lower(clean_name)
        and p.id <> uid
    ) then
      raise exception 'That fren name is already taken.';
    end if;
  end if;

  insert into public.profiles as p (
    id, silly_name, one_human_thing, bio, avatar_url, avatar_type, share_location, is_founder
  )
  values (
    uid,
    coalesce(clean_name, 'nameless fren'),
    p_one_human_thing,
    p_bio,
    p_avatar_url,
    coalesce(p_avatar_type, 'frog'),
    coalesce(p_share_location, false),
    coalesce(p_is_founder, false)
  )
  on conflict (id) do update set
    silly_name = coalesce(clean_name, p.silly_name),
    one_human_thing = coalesce(p_one_human_thing, p.one_human_thing),
    bio = coalesce(p_bio, p.bio),
    avatar_url = coalesce(p_avatar_url, p.avatar_url),
    avatar_type = coalesce(p_avatar_type, p.avatar_type),
    share_location = coalesce(p_share_location, p.share_location),
    is_founder = coalesce(p_is_founder, p.is_founder);
end;
$$;

grant execute on function public.signup_gate_open() to anon, authenticated;
grant execute on function public.validate_invite(text) to anon, authenticated;
grant execute on function public.peek_invite(text) to anon, authenticated;
grant execute on function public.claim_invite(text) to authenticated;
grant execute on function public.check_fren_name_available(text, uuid) to anon, authenticated;
grant execute on function public.get_invite_daily_quota() to authenticated;
grant execute on function public.create_invite_code() to authenticated;
grant execute on function public.list_my_invites() to authenticated;

notify pgrst, 'reload schema';
