-- Named moodboards: folders for gathered images with public/private visibility + reorder.
-- Safe to re-run. Run in Supabase → SQL Editor after supabase-patch-profile-gallery.sql.

create table if not exists public.profile_moodboards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  is_public boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists profile_moodboards_user_order_idx
  on public.profile_moodboards (user_id, sort_order, created_at);

grant select, insert, update, delete on public.profile_moodboards to authenticated;

alter table public.profile_moodboards enable row level security;

drop policy if exists "Moodboards readable by owner or public" on public.profile_moodboards;
create policy "Moodboards readable by owner or public"
  on public.profile_moodboards for select to authenticated
  using (user_id = auth.uid() or is_public = true);

drop policy if exists "Users create own moodboards" on public.profile_moodboards;
create policy "Users create own moodboards"
  on public.profile_moodboards for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own moodboards" on public.profile_moodboards;
create policy "Users update own moodboards"
  on public.profile_moodboards for update to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users delete own moodboards" on public.profile_moodboards;
create policy "Users delete own moodboards"
  on public.profile_moodboards for delete to authenticated
  using (user_id = auth.uid());

-- Link gallery items to a moodboard folder.
alter table public.profile_gallery_items
  add column if not exists moodboard_id uuid references public.profile_moodboards on delete cascade;

-- Migrate legacy flat gallery into a default board per user.
do $$
declare
  r record;
  mb_id uuid;
begin
  for r in
    select distinct g.user_id
    from public.profile_gallery_items g
    where g.moodboard_id is null
  loop
    select id into mb_id
    from public.profile_moodboards m
    where m.user_id = r.user_id and m.name = 'My moodboard'
    limit 1;

    if mb_id is null then
      insert into public.profile_moodboards (user_id, name, is_public, sort_order)
      values (r.user_id, 'My moodboard', true, 0)
      returning id into mb_id;
    end if;

    update public.profile_gallery_items
    set moodboard_id = mb_id
    where user_id = r.user_id and moodboard_id is null;
  end loop;
end $$;

create index if not exists profile_gallery_moodboard_order_idx
  on public.profile_gallery_items (moodboard_id, sort_order, created_at);

-- Owner-only updates on gallery items (reorder).
drop policy if exists "Users update own gallery items" on public.profile_gallery_items;
create policy "Users update own gallery items"
  on public.profile_gallery_items for update to authenticated
  using (user_id = auth.uid());

grant update on public.profile_gallery_items to authenticated;

create or replace function public.list_user_moodboards(p_user uuid)
returns table (
  id uuid,
  name text,
  is_public boolean,
  sort_order int,
  item_count bigint,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    m.id,
    m.name,
    m.is_public,
    m.sort_order,
    count(g.id) as item_count,
    m.created_at
  from public.profile_moodboards m
  left join public.profile_gallery_items g on g.moodboard_id = m.id
  where m.user_id = p_user
    and (m.user_id = auth.uid() or m.is_public = true)
  group by m.id
  order by m.sort_order asc, m.created_at asc
  limit 16;
$$;

create or replace function public.list_moodboard_items(p_moodboard uuid)
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
  join public.profile_moodboards m on m.id = g.moodboard_id
  where g.moodboard_id = p_moodboard
    and (m.user_id = auth.uid() or m.is_public = true)
  order by g.sort_order asc, g.created_at asc
  limit 24;
$$;

create or replace function public.create_moodboard(
  p_name text,
  p_is_public boolean default true
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
  clean_name text := trim(p_name);
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if clean_name is null or clean_name = '' then raise exception 'Name required'; end if;
  if length(clean_name) > 48 then raise exception 'Name too long (48 max)'; end if;

  if (select count(*) from public.profile_moodboards where user_id = uid) >= 16 then
    raise exception 'Moodboard limit reached (16 max)';
  end if;

  select coalesce(max(sort_order), -1) + 1 into next_order
  from public.profile_moodboards where user_id = uid;

  insert into public.profile_moodboards (user_id, name, is_public, sort_order)
  values (uid, clean_name, coalesce(p_is_public, true), next_order)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.update_moodboard(
  p_id uuid,
  p_name text default null,
  p_is_public boolean default null
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
  if uid is null then raise exception 'Not authenticated'; end if;

  clean_name := nullif(trim(p_name), '');
  if p_name is not null and clean_name is null then
    raise exception 'Name cannot be empty';
  end if;
  if clean_name is not null and length(clean_name) > 48 then
    raise exception 'Name too long (48 max)';
  end if;

  update public.profile_moodboards
  set
    name = coalesce(clean_name, name),
    is_public = coalesce(p_is_public, is_public)
  where id = p_id and user_id = uid;

  if not found then raise exception 'Moodboard not found'; end if;
end;
$$;

create or replace function public.delete_moodboard(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.profile_moodboards where id = p_id and user_id = uid;
  if not found then raise exception 'Moodboard not found'; end if;
end;
$$;

create or replace function public.add_moodboard_item(
  p_moodboard uuid,
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

  if not exists (
    select 1 from public.profile_moodboards m
    where m.id = p_moodboard and m.user_id = uid
  ) then
    raise exception 'Moodboard not found';
  end if;

  if (select count(*) from public.profile_gallery_items where moodboard_id = p_moodboard) >= 24 then
    raise exception 'Moodboard full (24 items max)';
  end if;

  select coalesce(max(sort_order), -1) + 1 into next_order
  from public.profile_gallery_items where moodboard_id = p_moodboard;

  insert into public.profile_gallery_items (
    user_id, moodboard_id, image_url, source_url, caption, sort_order
  )
  values (
    uid,
    p_moodboard,
    trim(p_image_url),
    nullif(trim(p_source_url), ''),
    nullif(trim(p_caption), ''),
    next_order
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.reorder_moodboard_items(
  p_moodboard uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  item_count int;
  ordered_count int;
  i int;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.profile_moodboards m
    where m.id = p_moodboard and m.user_id = uid
  ) then
    raise exception 'Moodboard not found';
  end if;

  select count(*) into item_count
  from public.profile_gallery_items
  where moodboard_id = p_moodboard;

  ordered_count := coalesce(array_length(p_ordered_ids, 1), 0);
  if ordered_count <> item_count then
    raise exception 'Reorder list must include every item once';
  end if;

  if exists (
    select 1
    from unnest(p_ordered_ids) x(id)
    left join public.profile_gallery_items g
      on g.id = x.id and g.moodboard_id = p_moodboard and g.user_id = uid
    where g.id is null
  ) then
    raise exception 'Invalid item in reorder list';
  end if;

  for i in 1..ordered_count loop
    update public.profile_gallery_items
    set sort_order = i - 1
    where id = p_ordered_ids[i] and moodboard_id = p_moodboard and user_id = uid;
  end loop;
end;
$$;

-- Keep legacy RPCs working by targeting the user's first moodboard (or creating one).
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
  mb_id uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select id into mb_id
  from public.profile_moodboards
  where user_id = uid
  order by sort_order asc, created_at asc
  limit 1;

  if mb_id is null then
    mb_id := public.create_moodboard('My moodboard', true);
  end if;

  return public.add_moodboard_item(mb_id, p_image_url, p_source_url, p_caption);
end;
$$;

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
  join public.profile_moodboards m on m.id = g.moodboard_id
  where m.user_id = p_user
    and (m.user_id = auth.uid() or m.is_public = true)
  order by m.sort_order asc, g.sort_order asc, g.created_at asc
  limit 24;
$$;

grant execute on function public.list_user_moodboards(uuid) to authenticated;
grant execute on function public.list_moodboard_items(uuid) to authenticated;
grant execute on function public.create_moodboard(text, boolean) to authenticated;
grant execute on function public.update_moodboard(uuid, text, boolean) to authenticated;
grant execute on function public.delete_moodboard(uuid) to authenticated;
grant execute on function public.add_moodboard_item(uuid, text, text, text) to authenticated;
grant execute on function public.reorder_moodboard_items(uuid, uuid[]) to authenticated;
grant execute on function public.add_profile_gallery_item(text, text, text) to authenticated;

notify pgrst, 'reload schema';
