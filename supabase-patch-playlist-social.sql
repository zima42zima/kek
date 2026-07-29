-- Playlist social: comments, track aura, liked tracks list.
-- Safe to re-run. Run after supabase-patch-playlists.sql.

create table if not exists public.playlist_comments (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid references public.profile_playlists(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  author_name text,
  avatar_type text default 'frog',
  avatar_url text,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists public.playlist_track_reactions (
  track_id uuid references public.profile_playlist_tracks(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  primary key (track_id, user_id)
);

grant select, insert, delete on public.playlist_comments to authenticated;
grant select, insert, delete on public.playlist_track_reactions to authenticated;

alter table public.playlist_comments enable row level security;
alter table public.playlist_track_reactions enable row level security;

drop policy if exists "Playlist comments readable" on public.playlist_comments;
create policy "Playlist comments readable"
  on public.playlist_comments for select to authenticated using (true);

drop policy if exists "Users add playlist comments" on public.playlist_comments;
create policy "Users add playlist comments"
  on public.playlist_comments for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own playlist comments" on public.playlist_comments;
create policy "Users delete own playlist comments"
  on public.playlist_comments for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Track reactions readable" on public.playlist_track_reactions;
create policy "Track reactions readable"
  on public.playlist_track_reactions for select to authenticated using (true);

drop policy if exists "Users add track reactions" on public.playlist_track_reactions;
create policy "Users add track reactions"
  on public.playlist_track_reactions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users remove track reactions" on public.playlist_track_reactions;
create policy "Users remove track reactions"
  on public.playlist_track_reactions for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists playlist_comments_playlist_idx
  on public.playlist_comments (playlist_id, created_at);

create index if not exists playlist_track_reactions_track_idx
  on public.playlist_track_reactions (track_id);

create index if not exists playlist_track_reactions_user_idx
  on public.playlist_track_reactions (user_id, created_at desc);

-- Tracks with aura counts for playlist detail view.
-- Must drop first: return type adds aura_count + i_gave_aura columns.
drop function if exists public.list_playlist_tracks(uuid);

create or replace function public.list_playlist_tracks(p_playlist uuid)
returns table (
  id uuid,
  video_type text,
  video_id text,
  video_url text,
  title text,
  sort_order int,
  created_at timestamptz,
  aura_count bigint,
  i_gave_aura boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id,
    t.video_type,
    t.video_id,
    t.video_url,
    t.title,
    t.sort_order,
    t.created_at,
    (select count(*) from public.playlist_track_reactions r where r.track_id = t.id) as aura_count,
    exists (
      select 1 from public.playlist_track_reactions r
      where r.track_id = t.id and r.user_id = auth.uid()
    ) as i_gave_aura
  from public.profile_playlist_tracks t
  where t.playlist_id = p_playlist
  order by t.sort_order asc, t.created_at asc
  limit 48;
$$;

create or replace function public.toggle_track_aura(p_track uuid)
returns table (aura_count bigint, i_gave_aura boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  had boolean;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select exists (
    select 1 from public.playlist_track_reactions where track_id = p_track and user_id = uid
  ) into had;

  if had then
    delete from public.playlist_track_reactions where track_id = p_track and user_id = uid;
  else
    insert into public.playlist_track_reactions (track_id, user_id)
    values (p_track, uid)
    on conflict do nothing;
  end if;

  return query
    select
      (select count(*) from public.playlist_track_reactions where track_id = p_track),
      (not had);
end;
$$;

create or replace function public.list_playlist_comments(p_playlist uuid)
returns table (
  id uuid,
  playlist_id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.playlist_id, c.user_id, c.author_name, c.avatar_type, c.avatar_url, c.body, c.created_at
  from public.playlist_comments c
  where c.playlist_id = p_playlist
  order by c.created_at asc
  limit 200;
$$;

create or replace function public.add_playlist_comment(
  p_playlist uuid,
  p_body text,
  p_author_name text default null,
  p_avatar_type text default 'frog',
  p_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(p_body), '') is null then raise exception 'Comment cannot be empty'; end if;

  if not exists (select 1 from public.profile_playlists where id = p_playlist) then
    raise exception 'Playlist not found';
  end if;

  insert into public.playlist_comments (playlist_id, user_id, author_name, avatar_type, avatar_url, body)
  values (p_playlist, uid, p_author_name, coalesce(p_avatar_type, 'frog'), p_avatar_url, trim(p_body))
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.delete_playlist_comment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.playlist_comments where id = p_id and user_id = uid;
end;
$$;

create or replace function public.list_my_liked_tracks(p_limit int default 48)
returns table (
  track_id uuid,
  video_type text,
  video_id text,
  video_url text,
  title text,
  playlist_id uuid,
  playlist_name text,
  owner_id uuid,
  owner_name text,
  liked_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id as track_id,
    t.video_type,
    t.video_id,
    t.video_url,
    t.title,
    p.id as playlist_id,
    p.name as playlist_name,
    p.user_id as owner_id,
    coalesce(pr.silly_name, 'fren') as owner_name,
    r.created_at as liked_at
  from public.playlist_track_reactions r
  join public.profile_playlist_tracks t on t.id = r.track_id
  join public.profile_playlists p on p.id = t.playlist_id
  left join public.profiles pr on pr.id = p.user_id
  where r.user_id = auth.uid()
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 48);
$$;

grant execute on function public.list_playlist_tracks(uuid) to authenticated;
grant execute on function public.toggle_track_aura(uuid) to authenticated;
grant execute on function public.list_playlist_comments(uuid) to authenticated;
grant execute on function public.add_playlist_comment(uuid, text, text, text, text) to authenticated;
grant execute on function public.delete_playlist_comment(uuid) to authenticated;
grant execute on function public.list_my_liked_tracks(int) to authenticated;

notify pgrst, 'reload schema';
