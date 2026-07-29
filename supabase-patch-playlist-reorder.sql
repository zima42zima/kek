-- Reorder tracks within a playlist (edit playlist layout).
-- Safe to re-run. Run in Supabase → SQL Editor.

create or replace function public.reorder_playlist_tracks(
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
  track_count int;
  ordered_count int;
  i int;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.profile_playlists
    where id = p_playlist and user_id = uid
  ) then
    raise exception 'Playlist not found';
  end if;

  select count(*) into track_count
  from public.profile_playlist_tracks
  where playlist_id = p_playlist;

  ordered_count := coalesce(array_length(p_ordered_ids, 1), 0);
  if ordered_count <> track_count then
    raise exception 'Reorder list must include every track once';
  end if;

  if exists (
    select 1
    from unnest(p_ordered_ids) x(id)
    left join public.profile_playlist_tracks t
      on t.id = x.id and t.playlist_id = p_playlist and t.user_id = uid
    where t.id is null
  ) then
    raise exception 'Invalid track in reorder list';
  end if;

  for i in 1..ordered_count loop
    update public.profile_playlist_tracks
    set sort_order = i - 1
    where id = p_ordered_ids[i] and playlist_id = p_playlist and user_id = uid;
  end loop;
end;
$$;

grant execute on function public.reorder_playlist_tracks(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
