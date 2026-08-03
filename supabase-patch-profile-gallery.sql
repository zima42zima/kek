-- Profile gallery ("gathered things") + optional Cosmos profile link.
-- Safe to re-run. Run in Supabase → SQL Editor.

alter table public.profiles add column if not exists cosmos_url text;

create table if not exists public.profile_gallery_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  image_url text not null,
  source_url text,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists profile_gallery_user_order_idx
  on public.profile_gallery_items (user_id, sort_order, created_at);

grant select, insert, delete on public.profile_gallery_items to authenticated;

alter table public.profile_gallery_items enable row level security;

drop policy if exists "Gallery readable by authenticated" on public.profile_gallery_items;
create policy "Gallery readable by authenticated"
  on public.profile_gallery_items for select to authenticated
  using (true);

drop policy if exists "Users add to own gallery" on public.profile_gallery_items;
create policy "Users add to own gallery"
  on public.profile_gallery_items for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users delete own gallery items" on public.profile_gallery_items;
create policy "Users delete own gallery items"
  on public.profile_gallery_items for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.list_profile_gallery(p_user uuid)
returns table (
  id uuid,
  image_url text,
  source_url text,
  caption text,
  sort_order int,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select g.id, g.image_url, g.source_url, g.caption, g.sort_order, g.created_at
  from public.profile_gallery_items g
  where g.user_id = p_user
  order by g.sort_order asc, g.created_at asc
  limit 24;
$$;

create or replace function public.add_profile_gallery_item(
  p_image_url text,
  p_source_url text default null,
  p_caption text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  next_order int;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(p_image_url), '') is null then raise exception 'Image URL required'; end if;

  if (select count(*) from public.profile_gallery_items where user_id = uid) >= 24 then
    raise exception 'Gallery full (24 items max)';
  end if;

  select coalesce(max(sort_order), -1) + 1
  into next_order
  from public.profile_gallery_items
  where user_id = uid;

  insert into public.profile_gallery_items (user_id, image_url, source_url, caption, sort_order)
  values (
    uid,
    trim(p_image_url),
    nullif(trim(p_source_url), ''),
    nullif(trim(p_caption), ''),
    next_order
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.remove_profile_gallery_item(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.profile_gallery_items
  where id = p_id and user_id = uid;
end;
$$;

-- Include cosmos_url on public profile cards.
-- Must drop first: Postgres cannot change a function's return columns via CREATE OR REPLACE.
drop function if exists public.get_profile_card(uuid);

create function public.get_profile_card(p_user uuid)
returns table (
  id uuid,
  name text,
  one_human_thing text,
  bio text,
  avatar_type text,
  avatar_url text,
  is_founder boolean,
  cosmos_url text,
  following bigint,
  followers bigint,
  i_follow boolean
)
language sql security definer set search_path = public stable as $$
  select
    pr.id,
    coalesce(pr.silly_name, 'a fren') as name,
    pr.one_human_thing,
    pr.bio,
    coalesce(pr.avatar_type, 'frog') as avatar_type,
    pr.avatar_url,
    coalesce(pr.is_founder, false) as is_founder,
    pr.cosmos_url,
    (select count(*) from public.follows where follower_id = pr.id) as following,
    (select count(*) from public.follows where following_id = pr.id) as followers,
    exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.following_id = pr.id
    ) as i_follow
  from public.profiles pr
  where pr.id = p_user;
$$;

grant execute on function public.list_profile_gallery(uuid) to authenticated;
grant execute on function public.add_profile_gallery_item(text, text, text) to authenticated;
grant execute on function public.remove_profile_gallery_item(uuid) to authenticated;
grant execute on function public.get_profile_card(uuid) to authenticated;

notify pgrst, 'reload schema';
