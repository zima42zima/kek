-- Profile playlists: named folders of YouTube / Vimeo links (free video platforms).
-- Safe to re-run. Run in Supabase → SQL Editor.
-- Supersedes supabase-patch-profile-music.sql when both exist.

create table if not exists public.profile_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.profile_playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid references public.profile_playlists on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  video_type text not null check (video_type in ('youtube', 'vimeo')),
  video_id text not null,
  video_url text not null,
  title text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists profile_playlists_user_order_idx
  on public.profile_playlists (user_id, sort_order, created_at);

create index if not exists profile_playlist_tracks_playlist_order_idx
  on public.profile_playlist_tracks (playlist_id, sort_order, created_at);

grant select, insert, update, delete on public.profile_playlists to authenticated;
grant select, insert, delete on public.profile_playlist_tracks to authenticated;

alter table public.profile_playlists enable row level security;
alter table public.profile_playlist_tracks enable row level security;

drop policy if exists "Playlists readable by authenticated" on public.profile_playlists;
create policy "Playlists readable by authenticated"
  on public.profile_playlists for select to authenticated using (true);

drop policy if exists "Users manage own playlists" on public.profile_playlists;
create policy "Users manage own playlists"
  on public.profile_playlists for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own playlists" on public.profile_playlists;
create policy "Users update own playlists"
  on public.profile_playlists for update to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users delete own playlists" on public.profile_playlists;
create policy "Users delete own playlists"
  on public.profile_playlists for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Playlist tracks readable by authenticated" on public.profile_playlist_tracks;
create policy "Playlist tracks readable by authenticated"
  on public.profile_playlist_tracks for select to authenticated using (true);

drop policy if exists "Users add own playlist tracks" on public.profile_playlist_tracks;
create policy "Users add own playlist tracks"
  on public.profile_playlist_tracks for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users delete own playlist tracks" on public.profile_playlist_tracks;
create policy "Users delete own playlist tracks"
  on public.profile_playlist_tracks for delete to authenticated
  using (user_id = auth.uid());

-- Migrate legacy flat profile_music_tracks into a default "My playlist" folder.
do $$
declare
  r record;
  pl_id uuid;
  next_order int;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profile_music_tracks'
  ) then
    return;
  end if;

  for r in select distinct user_id from public.profile_music_tracks loop
    if not exists (
      select 1 from public.profile_playlists p where p.user_id = r.user_id and p.name = 'My playlist'
    ) then
      insert into public.profile_playlists (user_id, name, sort_order)
      values (r.user_id, 'My playlist', 0)
      returning id into pl_id;

      insert into public.profile_playlist_tracks (
        playlist_id, user_id, video_type, video_id, video_url, title, sort_order, created_at
      )
      select
        pl_id,
        m.user_id,
        'youtube',
        m.youtube_id,
        m.youtube_url,
        m.title,
        m.sort_order,
        m.created_at
      from public.profile_music_tracks m
      where m.user_id = r.user_id
      order by m.sort_order, m.created_at;
    end if;
  end loop;
end $$;

create or replace function public.list_user_playlists(p_user uuid)
returns table (
  id uuid,
  name text,
  sort_order int,
  track_count bigint,
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
    p.created_at
  from public.profile_playlists p
  left join public.profile_playlist_tracks t on t.playlist_id = p.id
  where p.user_id = p_user
  group by p.id
  order by p.sort_order asc, p.created_at asc
  limit 16;
$$;

create or replace function public.list_playlist_tracks(p_playlist uuid)
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
  from public.profile_playlist_tracks t
  join public.profile_playlists p on p.id = t.playlist_id
  where t.playlist_id = p_playlist
  order by t.sort_order asc, t.created_at asc
  limit 48;
$$;

create or replace function public.create_profile_playlist(p_name text)
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
  if name is null then raise exception 'Playlist name required'; end if;
  if length(name) > 40 then raise exception 'Name too long (40 max)'; end if;

  if (select count(*) from public.profile_playlists where user_id = uid) >= 16 then
    raise exception 'Playlist limit reached (16 folders max)';
  end if;

  select coalesce(max(sort_order), -1) + 1 into next_order
  from public.profile_playlists where user_id = uid;

  insert into public.profile_playlists (user_id, name, sort_order)
  values (uid, name, next_order)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.rename_profile_playlist(p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_name text := nullif(trim(p_name), '');
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if new_name is null then raise exception 'Playlist name required'; end if;
  if length(new_name) > 40 then raise exception 'Name too long (40 max)'; end if;

  update public.profile_playlists
  set name = new_name
  where id = p_id and user_id = uid;

  if not found then raise exception 'Playlist not found'; end if;
end;
$$;

create or replace function public.delete_profile_playlist(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.profile_playlists where id = p_id and user_id = uid;
end;
$$;

create or replace function public.add_playlist_track(
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
  new_id uuid;
  next_order int;
  url text := nullif(trim(p_video_url), '');
  vtype text := nullif(trim(p_video_type), '');
  vid text := nullif(trim(p_video_id), '');
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if url is null or vtype is null or vid is null then raise exception 'Video link required'; end if;
  if vtype not in ('youtube', 'vimeo') then raise exception 'Only YouTube and Vimeo links are supported'; end if;
  if vtype = 'youtube' and length(vid) <> 11 then raise exception 'Invalid YouTube video'; end if;
  if vtype = 'vimeo' and vid !~ '^\d+$' then raise exception 'Invalid Vimeo video'; end if;

  if not exists (
    select 1 from public.profile_playlists where id = p_playlist and user_id = uid
  ) then
    raise exception 'Playlist not found';
  end if;

  if (select count(*) from public.profile_playlist_tracks where playlist_id = p_playlist) >= 48 then
    raise exception 'Playlist full (48 tracks max)';
  end if;

  if exists (
    select 1 from public.profile_playlist_tracks
    where playlist_id = p_playlist and video_type = vtype and video_id = vid
  ) then
    raise exception 'Track already in this playlist';
  end if;

  select coalesce(max(sort_order), -1) + 1 into next_order
  from public.profile_playlist_tracks where playlist_id = p_playlist;

  insert into public.profile_playlist_tracks (
    playlist_id, user_id, video_type, video_id, video_url, title, sort_order
  )
  values (p_playlist, uid, vtype, vid, url, nullif(trim(p_title), ''), next_order)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.remove_playlist_track(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.profile_playlist_tracks where id = p_id and user_id = uid;
end;
$$;

grant execute on function public.list_user_playlists(uuid) to authenticated;
grant execute on function public.list_playlist_tracks(uuid) to authenticated;
grant execute on function public.create_profile_playlist(text) to authenticated;
grant execute on function public.rename_profile_playlist(uuid, text) to authenticated;
grant execute on function public.delete_profile_playlist(uuid) to authenticated;
grant execute on function public.add_playlist_track(uuid, text, text, text, text) to authenticated;
grant execute on function public.remove_playlist_track(uuid) to authenticated;

notify pgrst, 'reload schema';
