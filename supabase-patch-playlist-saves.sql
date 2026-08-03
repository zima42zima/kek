-- Save frens' playlists to your music library.
-- Safe to re-run. Run after supabase-patch-playlists.sql.

create table if not exists public.saved_playlists (
  user_id uuid references auth.users on delete cascade not null,
  playlist_id uuid references public.profile_playlists(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (user_id, playlist_id)
);

grant select, insert, delete on public.saved_playlists to authenticated;
alter table public.saved_playlists enable row level security;

drop policy if exists "Saved playlists readable by owner" on public.saved_playlists;
create policy "Saved playlists readable by owner"
  on public.saved_playlists for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users save playlists" on public.saved_playlists;
create policy "Users save playlists"
  on public.saved_playlists for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users unsave playlists" on public.saved_playlists;
create policy "Users unsave playlists"
  on public.saved_playlists for delete to authenticated
  using (user_id = auth.uid());

create index if not exists saved_playlists_user_idx
  on public.saved_playlists (user_id, created_at desc);

create or replace function public.list_saved_playlists()
returns table (
  playlist_id uuid,
  name text,
  owner_id uuid,
  owner_name text,
  track_count bigint,
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
    s.created_at as saved_at
  from public.saved_playlists s
  join public.profile_playlists p on p.id = s.playlist_id
  left join public.profiles pr on pr.id = p.user_id
  where s.user_id = auth.uid()
  order by s.created_at desc
  limit 32;
$$;

create or replace function public.save_playlist(p_playlist uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select user_id into owner from public.profile_playlists where id = p_playlist;
  if owner is null then raise exception 'Playlist not found'; end if;
  if owner = uid then raise exception 'Cannot save your own playlist'; end if;

  insert into public.saved_playlists (user_id, playlist_id)
  values (uid, p_playlist)
  on conflict do nothing;
end;
$$;

create or replace function public.unsave_playlist(p_playlist uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.saved_playlists where user_id = uid and playlist_id = p_playlist;
end;
$$;

create or replace function public.is_playlist_saved(p_playlist uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.saved_playlists
    where user_id = auth.uid() and playlist_id = p_playlist
  );
$$;

grant execute on function public.list_saved_playlists() to authenticated;
grant execute on function public.save_playlist(uuid) to authenticated;
grant execute on function public.unsave_playlist(uuid) to authenticated;
grant execute on function public.is_playlist_saved(uuid) to authenticated;

notify pgrst, 'reload schema';
