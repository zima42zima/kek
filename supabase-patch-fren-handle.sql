-- Permanent fren handle + free display name (silly_name).
-- Run in Supabase → SQL Editor after other profile patches.
-- Safe to re-run.

alter table public.profiles add column if not exists fren_handle text;

-- Existing accounts: lock in current silly_name as their permanent handle.
update public.profiles
set fren_handle = lower(trim(silly_name))
where fren_handle is null
  and trim(coalesce(silly_name, '')) <> ''
  and lower(trim(silly_name)) <> 'nameless fren';

-- Display names no longer need to be globally unique.
drop index if exists public.profiles_silly_name_lower_uniq;

create unique index if not exists profiles_fren_handle_lower_uniq
  on public.profiles (lower(trim(fren_handle)))
  where trim(coalesce(fren_handle, '')) <> '';

-- Is this handle free? (signup + pre-claim checks)
create or replace function public.check_fren_handle_available(p_handle text, p_exclude_user uuid default null)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when trim(coalesce(p_handle, '')) = '' then false
    when lower(trim(p_handle)) in ('nameless fren', 'frens', 'admin', 'founder', 'anonymous', 'null') then false
    else not exists (
      select 1
      from public.profiles p
      where lower(trim(p.fren_handle)) = lower(trim(p_handle))
        and (p_exclude_user is null or p.id <> p_exclude_user)
    )
  end;
$$;

-- One-time handle claim at signup. Handle is immutable after this.
create or replace function public.claim_fren_handle(
  p_handle text,
  p_display_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_handle text;
  clean_display text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = uid and nullif(trim(p.fren_handle), '') is not null
  ) then
    raise exception 'Handle already set for this account.';
  end if;

  clean_handle := lower(trim(p_handle));
  if clean_handle is null or length(clean_handle) < 3 or length(clean_handle) > 20 then
    raise exception 'Handle must be 3–20 characters.';
  end if;
  if clean_handle !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'Handle must start with a letter; use letters, numbers, underscores only.';
  end if;
  if clean_handle in ('frens', 'admin', 'founder', 'anonymous', 'null') then
    raise exception 'That handle is reserved.';
  end if;
  if not public.check_fren_handle_available(clean_handle, uid) then
    raise exception 'That handle is already taken.';
  end if;

  clean_display := nullif(trim(p_display_name), '');
  if clean_display is not null and length(clean_display) > 40 then
    raise exception 'Display name max 40 characters.';
  end if;

  insert into public.profiles as p (id, silly_name, fren_handle)
  values (uid, coalesce(clean_display, clean_handle), clean_handle)
  on conflict (id) do update set
    fren_handle = excluded.fren_handle,
    silly_name = coalesce(clean_display, excluded.silly_name, p.silly_name);
end;
$$;

-- Profile save: display name is free to change; handle never changes here.
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
  clean_display text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  clean_display := nullif(trim(p_silly_name), '');
  if clean_display is not null and length(clean_display) > 40 then
    raise exception 'Display name max 40 characters.';
  end if;

  insert into public.profiles as p (
    id, silly_name, one_human_thing, bio, avatar_url, avatar_type, share_location, is_founder
  )
  values (
    uid,
    coalesce(clean_display, 'nameless fren'),
    p_one_human_thing,
    p_bio,
    p_avatar_url,
    coalesce(p_avatar_type, 'frog'),
    coalesce(p_share_location, false),
    coalesce(p_is_founder, false)
  )
  on conflict (id) do update set
    silly_name = coalesce(clean_display, p.silly_name),
    one_human_thing = coalesce(p_one_human_thing, p.one_human_thing),
    bio = coalesce(p_bio, p.bio),
    avatar_url = coalesce(p_avatar_url, p.avatar_url),
    avatar_type = coalesce(p_avatar_type, p.avatar_type),
    share_location = coalesce(p_share_location, p.share_location),
    is_founder = coalesce(p_is_founder, p.is_founder);
end;
$$;

-- Backwards compat: old client checks map to handle availability.
create or replace function public.check_fren_name_available(p_name text, p_exclude_user uuid default null)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.check_fren_handle_available(p_name, p_exclude_user);
$$;

drop function if exists public.list_followers(uuid);
create function public.list_followers(p_user uuid)
returns table (
  user_id uuid,
  handle text,
  name text,
  avatar_type text,
  avatar_url text,
  bio text,
  i_follow boolean
)
language sql security definer set search_path = public stable as $$
  select
    pr.id,
    pr.fren_handle as handle,
    coalesce(pr.silly_name, 'a fren') as name,
    coalesce(pr.avatar_type, 'frog') as avatar_type,
    pr.avatar_url,
    pr.bio,
    exists (
      select 1 from public.follows f2
      where f2.follower_id = auth.uid() and f2.following_id = pr.id
    ) as i_follow
  from public.follows f
  join public.profiles pr on pr.id = f.follower_id
  where f.following_id = p_user
  order by f.created_at desc;
$$;

drop function if exists public.list_following(uuid);
create function public.list_following(p_user uuid)
returns table (
  user_id uuid,
  handle text,
  name text,
  avatar_type text,
  avatar_url text,
  bio text,
  i_follow boolean
)
language sql security definer set search_path = public stable as $$
  select
    pr.id,
    pr.fren_handle as handle,
    coalesce(pr.silly_name, 'a fren') as name,
    coalesce(pr.avatar_type, 'frog') as avatar_type,
    pr.avatar_url,
    pr.bio,
    exists (
      select 1 from public.follows f2
      where f2.follower_id = auth.uid() and f2.following_id = pr.id
    ) as i_follow
  from public.follows f
  join public.profiles pr on pr.id = f.following_id
  where f.follower_id = p_user
  order by f.created_at desc;
$$;

drop function if exists public.get_profile_card(uuid);
create function public.get_profile_card(p_user uuid)
returns table (
  id uuid,
  handle text,
  name text,
  one_human_thing text,
  bio text,
  avatar_type text,
  avatar_url text,
  is_founder boolean,
  cosmos_url text,
  owl_post_open boolean,
  following bigint,
  followers bigint,
  i_follow boolean
)
language sql security definer set search_path = public stable as $$
  select
    pr.id,
    pr.fren_handle as handle,
    coalesce(pr.silly_name, 'a fren') as name,
    pr.one_human_thing,
    pr.bio,
    coalesce(pr.avatar_type, 'frog') as avatar_type,
    pr.avatar_url,
    coalesce(pr.is_founder, false) as is_founder,
    pr.cosmos_url,
    public.get_public_owl_status(pr.id) as owl_post_open,
    (select count(*) from public.follows where follower_id = pr.id) as following,
    (select count(*) from public.follows where following_id = pr.id) as followers,
    exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.following_id = pr.id
    ) as i_follow
  from public.profiles pr
  where pr.id = p_user;
$$;

grant execute on function public.check_fren_handle_available(text, uuid) to anon, authenticated;
grant execute on function public.claim_fren_handle(text, text) to authenticated;
grant execute on function public.check_fren_name_available(text, uuid) to anon, authenticated;
grant execute on function public.list_followers(uuid) to authenticated;
grant execute on function public.list_following(uuid) to authenticated;
grant execute on function public.get_profile_card(uuid) to authenticated;

notify pgrst, 'reload schema';
