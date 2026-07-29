-- Optional cover photos for profile playlists.
-- Safe to re-run. Run after supabase-patch-playlists.sql.

alter table public.profile_playlists
  add column if not exists cover_url text;

-- Return type adds cover_url — must drop before recreate.
drop function if exists public.list_user_playlists(uuid);
drop function if exists public.list_saved_playlists();

create or replace function public.list_user_playlists(p_user uuid)
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
  from public.profile_playlists p
  left join public.profile_playlist_tracks t on t.playlist_id = p.id
  where p.user_id = p_user
  group by p.id
  order by p.sort_order asc, p.created_at asc
  limit 16;
$$;

create or replace function public.list_saved_playlists()
returns table (
  playlist_id uuid,
  name text,
  owner_id uuid,
  owner_name text,
  track_count bigint,
  cover_url text,
  saved_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id as playlist_id,
    p.name,
    p.user_id as owner_id,
    coalesce(pr.silly_name, 'fren') as owner_name,
    (select count(*) from public.profile_playlist_tracks t where t.playlist_id = p.id) as track_count,
    p.cover_url,
    s.created_at as saved_at
  from public.saved_playlists s
  join public.profile_playlists p on p.id = s.playlist_id
  left join public.profiles pr on pr.id = p.user_id
  where s.user_id = auth.uid()
  order by s.created_at desc
  limit 32;
$$;

create or replace function public.set_playlist_cover(p_id uuid, p_cover_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
  url text := nullif(trim(p_cover_url), '');
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  update public.profile_playlists
  set cover_url = url
  where id = p_id and user_id = uid;

  if not found then raise exception 'Playlist not found'; end if;
end;
$$;

grant execute on function public.list_user_playlists(uuid) to authenticated;
grant execute on function public.list_saved_playlists() to authenticated;
grant execute on function public.set_playlist_cover(uuid, text) to authenticated;

notify pgrst, 'reload schema';
