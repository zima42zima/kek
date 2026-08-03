-- Cave playlists — shared music folders inside each cave.
-- Moderated by cave founder or the active Seasonal DJ title.
-- Safe to re-run. Run in Supabase → SQL Editor.
-- Prerequisites: supabase-patch-playlists.sql, supabase-patch-cave-roles.sql

create table if not exists public.cave_playlists (
  id uuid primary key default gen_random_uuid(),
  cave_id text references public.caves(id) on delete cascade not null,
  name text not null,
  cover_url text,
  sort_order int not null default 0,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.cave_playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid references public.cave_playlists on delete cascade not null,
  cave_id text references public.caves(id) on delete cascade not null,
  added_by uuid references auth.users on delete set null,
  video_type text not null check (video_type in ('youtube', 'vimeo')),
  video_id text not null,
  video_url text not null,
  title text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists cave_playlists_cave_order_idx
  on public.cave_playlists (cave_id, sort_order, created_at);

create index if not exists cave_playlist_tracks_playlist_order_idx
  on public.cave_playlist_tracks (playlist_id, sort_order, created_at);

grant select on public.cave_playlists to authenticated;
grant select on public.cave_playlist_tracks to authenticated;

alter table public.cave_playlists enable row level security;
alter table public.cave_playlist_tracks enable row level security;

drop policy if exists "Cave playlists readable by members" on public.cave_playlists;
create policy "Cave playlists readable by members"
  on public.cave_playlists for select to authenticated
  using (
    exists (
      select 1 from public.cave_members cm
      where cm.cave_id = cave_playlists.cave_id and cm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.caves c
      where c.id = cave_playlists.cave_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Cave playlist tracks readable by members" on public.cave_playlist_tracks;
create policy "Cave playlist tracks readable by members"
  on public.cave_playlist_tracks for select to authenticated
  using (
    exists (
      select 1 from public.cave_members cm
      where cm.cave_id = cave_playlist_tracks.cave_id and cm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.caves c
      where c.id = cave_playlist_tracks.cave_id and c.owner_id = auth.uid()
    )
  );

create or replace function public.is_cave_member(p_cave_id text, p_user uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.caves c where c.id = p_cave_id and c.owner_id = p_user
  ) or exists (
    select 1 from public.cave_members cm
    where cm.cave_id = p_cave_id and cm.user_id = p_user
  );
$$;

create or replace function public.is_cave_playlist_moderator(p_cave_id text, p_user uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.caves c
    where c.id = p_cave_id and c.owner_id = p_user
  ) or exists (
    select 1 from public.cave_members cm
    where cm.cave_id = p_cave_id and cm.user_id = p_user
      and cm.fun_title = 'seasonal_dj'
      and (cm.title_expires_at is null or cm.title_expires_at > now())
  );
$$;

create or replace function public.list_cave_playlists(p_cave text)
returns table (
  id uuid,
  name text,
  sort_order int,
  track_count bigint,
  cover_url text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.name,
    p.sort_order,
    count(t.id) as track_count,
    p.cover_url,
    p.created_at
  from public.cave_playlists p
  left join public.cave_playlist_tracks t on t.playlist_id = p.id
  where p.cave_id = p_cave
    and public.is_cave_member(p_cave, auth.uid())
  group by p.id
  order by p.sort_order asc, p.created_at asc
  limit 12;
$$;

create or replace function public.list_cave_playlist_tracks(p_playlist uuid)
returns table (
  id uuid,
  video_type text,
  video_id text,
  video_url text,
  title text,
  sort_order int,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.video_type, t.video_id, t.video_url, t.title, t.sort_order, t.created_at
  from public.cave_playlist_tracks t
  join public.cave_playlists p on p.id = t.playlist_id
  where t.playlist_id = p_playlist
    and public.is_cave_member(p.cave_id, auth.uid())
  order by t.sort_order asc, t.created_at asc
  limit 48;
$$;

create or replace function public.create_cave_playlist(p_cave text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  next_order int;
  name text := nullif(trim(p_name), '');
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not public.is_cave_playlist_moderator(p_cave, uid) then
    raise exception 'Only the cave founder or Seasonal DJ can manage playlists';
  end if;
  if name is null then raise exception 'Playlist name required'; end if;
  if length(name) > 40 then raise exception 'Name too long (40 max)'; end if;

  if (select count(*) from public.cave_playlists where cave_id = p_cave) >= 12 then
    raise exception 'Cave playlist limit reached (12 max)';
  end if;

  select coalesce(max(sort_order), -1) + 1 into next_order
  from public.cave_playlists where cave_id = p_cave;

  insert into public.cave_playlists (cave_id, name, sort_order, created_by)
  values (p_cave, name, next_order, uid)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.delete_cave_playlist(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select cave_id into cid from public.cave_playlists where id = p_id;
  if cid is null then raise exception 'Playlist not found'; end if;
  if not public.is_cave_playlist_moderator(cid, uid) then
    raise exception 'Only the cave founder or Seasonal DJ can manage playlists';
  end if;

  delete from public.cave_playlists where id = p_id;
end;
$$;

create or replace function public.set_cave_playlist_cover(p_id uuid, p_cover_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid text;
  url text := nullif(trim(p_cover_url), '');
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select cave_id into cid from public.cave_playlists where id = p_id;
  if cid is null then raise exception 'Playlist not found'; end if;
  if not public.is_cave_playlist_moderator(cid, uid) then
    raise exception 'Only the cave founder or Seasonal DJ can manage playlists';
  end if;

  update public.cave_playlists set cover_url = url where id = p_id;
end;
$$;

create or replace function public.add_cave_playlist_track(
  p_playlist uuid,
  p_video_url text,
  p_video_type text,
  p_video_id text,
  p_title text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid text;
  new_id uuid;
  next_order int;
  url text := nullif(trim(p_video_url), '');
  vtype text := nullif(trim(p_video_type), '');
  vid text := nullif(trim(p_video_id), '');
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if url is null or vtype is null or vid is null then raise exception 'Video link required'; end if;
  if vtype not in ('youtube', 'vimeo') then raise exception 'Only YouTube and Vimeo links are supported'; end if;

  select cave_id into cid from public.cave_playlists where id = p_playlist;
  if cid is null then raise exception 'Playlist not found'; end if;
  if not public.is_cave_playlist_moderator(cid, uid) then
    raise exception 'Only the cave founder or Seasonal DJ can manage playlists';
  end if;

  if (select count(*) from public.cave_playlist_tracks where playlist_id = p_playlist) >= 48 then
    raise exception 'Playlist full (48 tracks max)';
  end if;

  if exists (
    select 1 from public.cave_playlist_tracks
    where playlist_id = p_playlist and video_type = vtype and video_id = vid
  ) then
    raise exception 'Track already in this playlist';
  end if;

  select coalesce(max(sort_order), -1) + 1 into next_order
  from public.cave_playlist_tracks where playlist_id = p_playlist;

  insert into public.cave_playlist_tracks (
    playlist_id, cave_id, added_by, video_type, video_id, video_url, title, sort_order
  )
  values (p_playlist, cid, uid, vtype, vid, url, nullif(trim(p_title), ''), next_order)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.remove_cave_playlist_track(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select cave_id into cid from public.cave_playlist_tracks where id = p_id;
  if cid is null then raise exception 'Track not found'; end if;
  if not public.is_cave_playlist_moderator(cid, uid) then
    raise exception 'Only the cave founder or Seasonal DJ can manage playlists';
  end if;

  delete from public.cave_playlist_tracks where id = p_id;
end;
$$;

create or replace function public.reorder_cave_playlist_tracks(
  p_playlist uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid text;
  track_count int;
  ordered_count int;
  i int;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select cave_id into cid from public.cave_playlists where id = p_playlist;
  if cid is null then raise exception 'Playlist not found'; end if;
  if not public.is_cave_playlist_moderator(cid, uid) then
    raise exception 'Only the cave founder or Seasonal DJ can manage playlists';
  end if;

  select count(*) into track_count
  from public.cave_playlist_tracks where playlist_id = p_playlist;

  ordered_count := coalesce(array_length(p_ordered_ids, 1), 0);
  if ordered_count <> track_count then
    raise exception 'Reorder list must include every track once';
  end if;

  for i in 1..ordered_count loop
    update public.cave_playlist_tracks
    set sort_order = i - 1
    where id = p_ordered_ids[i] and playlist_id = p_playlist;
  end loop;
end;
$$;

grant execute on function public.is_cave_member(text, uuid) to authenticated;
grant execute on function public.is_cave_playlist_moderator(text, uuid) to authenticated;
grant execute on function public.list_cave_playlists(text) to authenticated;
grant execute on function public.list_cave_playlist_tracks(uuid) to authenticated;
grant execute on function public.create_cave_playlist(text, text) to authenticated;
grant execute on function public.delete_cave_playlist(uuid) to authenticated;
grant execute on function public.set_cave_playlist_cover(uuid, text) to authenticated;
grant execute on function public.add_cave_playlist_track(uuid, text, text, text, text) to authenticated;
grant execute on function public.remove_cave_playlist_track(uuid) to authenticated;
grant execute on function public.reorder_cave_playlist_tracks(uuid, uuid[]) to authenticated;

-- Refresh PostgREST schema cache (may take a few seconds in the dashboard).
notify pgrst, 'reload schema';
