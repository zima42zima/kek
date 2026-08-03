-- Run this in Supabase → SQL Editor before using the app.
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.

create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  silly_name text not null,
  one_human_thing text,
  favorite_fail text,
  current_vibe text,
  bio text,
  avatar_url text,
  avatar_type text default 'frog',
  share_location boolean default false,
  is_founder boolean default false,
  created_at timestamp with time zone default now()
);

-- Add new columns to existing projects (safe to re-run)
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists avatar_type text default 'frog';
alter table profiles add column if not exists share_location boolean default false;
alter table profiles add column if not exists is_founder boolean default false;

create table if not exists invites (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  created_by uuid references auth.users on delete set null,
  used_by uuid references auth.users on delete set null,
  created_at timestamp with time zone default now(),
  used_at timestamp with time zone
);

alter table profiles enable row level security;
alter table invites enable row level security;

-- Table privileges (fixes "permission denied for table profiles")
grant usage on schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;

grant all on all tables in schema public to postgres, service_role;
grant select, insert, update on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

grant all on all routines in schema public to postgres, service_role;
grant execute on all routines in schema public to authenticated;

alter default privileges for role postgres in schema public
  grant select, insert, update on tables to authenticated;
alter default privileges for role postgres in schema public
  grant select on tables to anon;
alter default privileges for role postgres in schema public
  grant execute on routines to authenticated;

-- RLS policies
drop policy if exists "Profiles are viewable by authenticated users" on profiles;
create policy "Profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on profiles;
create policy "Users can insert their own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Invites are viewable by authenticated users" on invites;
create policy "Invites are viewable by authenticated users"
  on invites for select
  to authenticated
  using (true);

drop policy if exists "Gate can validate unused invites" on invites;
create policy "Gate can validate unused invites"
  on invites for select
  to anon, authenticated
  using (used_by is null);

drop policy if exists "Users can create invites" on invites;
create policy "Users can create invites"
  on invites for insert
  to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "Anyone authenticated can mark an invite used" on invites;
create policy "Anyone authenticated can mark an invite used"
  on invites for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Auto-create a profile row when someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, silly_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'silly_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'nameless fren'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profile RPCs (work even if table grants were missed; run as postgres)
create or replace function public.get_my_profile()
returns setof public.profiles
language sql
security definer
set search_path = public
stable
as $$
  select * from public.profiles where id = auth.uid();
$$;

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
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles as p (
    id, silly_name, one_human_thing, bio, avatar_url, avatar_type, share_location, is_founder
  )
  values (
    uid,
    coalesce(nullif(trim(p_silly_name), ''), 'nameless fren'),
    p_one_human_thing,
    p_bio,
    p_avatar_url,
    coalesce(p_avatar_type, 'frog'),
    coalesce(p_share_location, false),
    coalesce(p_is_founder, false)
  )
  on conflict (id) do update set
    silly_name = coalesce(nullif(trim(p_silly_name), ''), p.silly_name),
    one_human_thing = coalesce(p_one_human_thing, p.one_human_thing),
    bio = coalesce(p_bio, p.bio),
    avatar_url = coalesce(p_avatar_url, p.avatar_url),
    avatar_type = coalesce(p_avatar_type, p.avatar_type),
    share_location = coalesce(p_share_location, p.share_location),
    is_founder = coalesce(p_is_founder, p.is_founder);
end;
$$;

grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.upsert_my_profile(text, text, text, text, text, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';

-- Optional: avatar storage (run once in SQL Editor if using photo uploads)
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
--   on conflict (id) do nothing;
--
-- drop policy if exists "Avatar images are publicly accessible" on storage.objects;
-- create policy "Avatar images are publicly accessible"
--   on storage.objects for select using (bucket_id = 'avatars');
--
-- drop policy if exists "Users can upload their own avatar" on storage.objects;
-- create policy "Users can upload their own avatar"
--   on storage.objects for insert
--   with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
--
-- drop policy if exists "Users can update their own avatar" on storage.objects;
-- create policy "Users can update their own avatar"
--   on storage.objects for update
--   using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
