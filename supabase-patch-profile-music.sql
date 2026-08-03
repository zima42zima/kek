-- Profile music playlist (YouTube links).
-- Safe to re-run. Run in Supabase → SQL Editor.

create table if not exists public.profile_music_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  youtube_url text not null,
  youtube_id text not null,
  title text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists profile_music_user_order_idx
  on public.profile_music_tracks (user_id, sort_order, created_at);

grant select, insert, delete on public.profile_music_tracks to authenticated;
alter table public.profile_music_tracks enable row level security;

drop policy if exists "Music readable by authenticated" on public.profile_music_tracks;
create policy "Music readable by authenticated"
  on public.profile_music_tracks for select to authenticated using (true);

drop policy if exists "Users add own music tracks" on public.profile_music_tracks;
create policy "Users add own music tracks"
  on public.profile_music_tracks for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users delete own music tracks" on public.profile_music_tracks;
create policy "Users delete own music tracks"
  on public.profile_music_tracks for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.list_profile_music(p_user uuid)
returns table (
  id uuid,
  youtube_url text,
  youtube_id text,
  title text,
  sort_order int,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select m.id, m.youtube_url, m.youtube_id, m.title, m.sort_order, m.created_at
  from public.profile_music_tracks m
  where m.user_id = p_user
  order by m.sort_order asc, m.created_at asc
  limit 48;
$$;

create or replace function public.add_profile_music_track(
  p_youtube_url text,
  p_youtube_id text,
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
  url text := nullif(trim(p_youtube_url), '');
  yt_id text := nullif(trim(p_youtube_id), '');
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if url is null or yt_id is null then raise exception 'YouTube URL required'; end if;
  if length(yt_id) <> 11 then raise exception 'Invalid YouTube video'; end if;

  if (select count(*) from public.profile_music_tracks where user_id = uid) >= 48 then
    raise exception 'Playlist full (48 tracks max)';
  end if;

  select coalesce(max(sort_order), -1) + 1
  into next_order
  from public.profile_music_tracks
  where user_id = uid;

  insert into public.profile_music_tracks (user_id, youtube_url, youtube_id, title, sort_order)
  values (uid, url, yt_id, nullif(trim(p_title), ''), next_order)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.remove_profile_music_track(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.profile_music_tracks
  where id = p_id and user_id = uid;
end;
$$;

grant execute on function public.list_profile_music(uuid) to authenticated;
grant execute on function public.add_profile_music_track(text, text, text) to authenticated;
grant execute on function public.remove_profile_music_track(uuid) to authenticated;

notify pgrst, 'reload schema';
