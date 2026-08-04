-- Echo public title (short note / joke / thought, max 222 chars)
-- Run in Supabase SQL Editor after existing echo browse patches.

alter table public.echoes
  add column if not exists title text;

do $$
begin
  alter table public.echoes
    drop constraint if exists echoes_title_len;
  alter table public.echoes
    add constraint echoes_title_len check (title is null or char_length(title) <= 222);
exception
  when others then null;
end $$;

-- publish_echo: drop prior overloads, recreate with p_title
drop function if exists public.publish_echo(
  text, text, text, double precision, double precision,
  text, text, boolean, boolean, text, text, timestamptz, text, double precision, text, boolean
);
drop function if exists public.publish_echo(
  text, text, text, double precision, double precision,
  text, text, boolean, boolean, text, text, text, timestamptz, text, double precision, text, boolean
);

create or replace function public.publish_echo(
  p_kind text,
  p_visibility text,
  p_media_path text,
  p_lat double precision,
  p_lon double precision,
  p_voice_filter text default null,
  p_sense_filter text default null,
  p_allow_comments boolean default false,
  p_share_on_profile boolean default true,
  p_label text default null,
  p_title text default null,
  p_city_label text default null,
  p_expires_at timestamptz default null,
  p_cover_path text default null,
  p_discover_radius_m double precision default 800,
  p_place_label text default null,
  p_browse_globally boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $publish$
declare
  uid uuid := auth.uid();
  new_id uuid;
  radius_m double precision;
  browse_global boolean;
  clean_title text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_kind not in ('audio', 'video', 'image') then raise exception 'Invalid kind'; end if;
  if p_visibility not in ('world', 'friends', 'private') then raise exception 'Invalid visibility'; end if;
  if p_media_path is null or p_media_path = '' then raise exception 'Missing media'; end if;
  if strpos(p_media_path, uid::text || '/') <> 1 then raise exception 'Invalid media path'; end if;
  if p_cover_path is not null and p_cover_path <> '' and strpos(p_cover_path, uid::text || '/') <> 1 then raise exception 'Invalid cover path'; end if;
  radius_m := coalesce(p_discover_radius_m, 800);
  if radius_m < 420 or radius_m > 2500 then raise exception 'Discover radius must be between 420m and 2500m'; end if;
  browse_global := coalesce(p_browse_globally, false) and p_visibility = 'world';
  clean_title := nullif(left(trim(coalesce(p_title, '')), 222), '');
  insert into public.echoes (
    owner_id, kind, visibility, media_path, cover_path, lat, lon,
    voice_filter, sense_filter, allow_comments, share_on_profile,
    label, title, city_label, place_label, expires_at, discover_radius_m, browse_globally
  )
  values (
    uid, p_kind, p_visibility, p_media_path, nullif(trim(p_cover_path), ''),
    p_lat, p_lon, p_voice_filter, p_sense_filter, coalesce(p_allow_comments, false),
    coalesce(p_share_on_profile, true), nullif(trim(p_label), ''), clean_title,
    nullif(trim(p_city_label), ''),
    nullif(trim(p_place_label), ''), p_expires_at, radius_m, browse_global
  )
  returning id into new_id;
  return new_id;
end;
$publish$;

grant execute on function public.publish_echo(
  text, text, text, double precision, double precision,
  text, text, boolean, boolean, text, text, text, timestamptz, text, double precision, text, boolean
) to authenticated;

-- list_echoes_near
drop function if exists public.list_echoes_near(double precision, double precision, double precision);

create or replace function public.list_echoes_near(
  p_lat double precision, p_lon double precision, p_radius_m double precision default 2500
)
returns table (
  id uuid, owner_id uuid, author_name text, avatar_type text, avatar_url text,
  kind text, visibility text, media_path text, cover_path text,
  lat double precision, lon double precision,
  voice_filter text, sense_filter text, allow_comments boolean, share_on_profile boolean,
  label text, title text, city_label text, place_label text, created_at timestamptz,
  distance_m double precision, discover_radius_m double precision,
  browse_globally boolean, expires_at timestamptz, aura_count bigint, i_gave_aura boolean
)
language sql security definer set search_path = public stable
as $near$
  select e.id, e.owner_id, coalesce(p.silly_name, 'a fren'), coalesce(p.avatar_type, 'frog'), p.avatar_url,
    e.kind, e.visibility, e.media_path, e.cover_path, e.lat, e.lon,
    e.voice_filter, e.sense_filter, e.allow_comments, e.share_on_profile,
    e.label, e.title, e.city_label, e.place_label, e.created_at,
    public.echo_distance_m(p_lat, p_lon, e.lat, e.lon), e.discover_radius_m, e.browse_globally, e.expires_at,
    (select count(*) from public.echo_reactions r where r.echo_id = e.id),
    exists (select 1 from public.echo_reactions r where r.echo_id = e.id and r.user_id = auth.uid())
  from public.echoes e
  left join public.profiles p on p.id = e.owner_id
  where e.hidden = false and e.visibility in ('world', 'friends')
    and (e.expires_at is null or e.expires_at > now())
    and public.echo_distance_m(p_lat, p_lon, e.lat, e.lon) <= least(p_radius_m, 2500)
  order by public.echo_distance_m(p_lat, p_lon, e.lat, e.lon) asc limit 200;
$near$;

grant execute on function public.list_echoes_near(double precision, double precision, double precision) to authenticated;

-- list_my_echoes
drop function if exists public.list_my_echoes();

create or replace function public.list_my_echoes()
returns table (
  id uuid, owner_id uuid, kind text, visibility text, media_path text, cover_path text,
  lat double precision, lon double precision, voice_filter text, sense_filter text,
  allow_comments boolean, share_on_profile boolean, label text, title text, city_label text, place_label text,
  expires_at timestamptz, hidden boolean, created_at timestamptz,
  discover_radius_m double precision, browse_globally boolean, aura_count bigint, i_gave_aura boolean
)
language sql security definer set search_path = public stable
as $mine$
  select e.id, e.owner_id, e.kind, e.visibility, e.media_path, e.cover_path,
    e.lat, e.lon, e.voice_filter, e.sense_filter, e.allow_comments, e.share_on_profile,
    e.label, e.title, e.city_label, e.place_label, e.expires_at, e.hidden, e.created_at,
    e.discover_radius_m, e.browse_globally,
    (select count(*) from public.echo_reactions r where r.echo_id = e.id),
    exists (select 1 from public.echo_reactions r where r.echo_id = e.id and r.user_id = auth.uid())
  from public.echoes e
  where e.owner_id = auth.uid()
  order by e.created_at desc limit 200;
$mine$;

grant execute on function public.list_my_echoes() to authenticated;

-- list_echoes_in_bbox
create or replace function public.list_echoes_in_bbox(
  p_south double precision,
  p_west double precision,
  p_north double precision,
  p_east double precision,
  p_limit int default 150
)
returns table (
  id uuid, owner_id uuid, author_name text, avatar_type text, avatar_url text,
  kind text, visibility text, media_path text, cover_path text,
  lat double precision, lon double precision,
  voice_filter text, sense_filter text, allow_comments boolean, share_on_profile boolean,
  label text, title text, city_label text, place_label text, created_at timestamptz,
  discover_radius_m double precision, browse_globally boolean, expires_at timestamptz,
  aura_count bigint, i_gave_aura boolean
)
language sql security definer set search_path = public stable
as $bbox$
  select e.id, e.owner_id, coalesce(p.silly_name, 'a fren'), coalesce(p.avatar_type, 'frog'), p.avatar_url,
    e.kind, e.visibility, e.media_path, e.cover_path, e.lat, e.lon,
    e.voice_filter, e.sense_filter, e.allow_comments, e.share_on_profile,
    e.label, e.title, e.city_label, e.place_label, e.created_at,
    e.discover_radius_m, e.browse_globally, e.expires_at,
    (select count(*) from public.echo_reactions r where r.echo_id = e.id),
    exists (select 1 from public.echo_reactions r where r.echo_id = e.id and r.user_id = auth.uid())
  from public.echoes e
  left join public.profiles p on p.id = e.owner_id
  where e.hidden = false and e.visibility = 'world' and e.browse_globally = true
    and (e.expires_at is null or e.expires_at > now())
    and e.lat between p_south and p_north and e.lon between p_west and p_east
  order by e.created_at desc
  limit least(greatest(coalesce(p_limit, 150), 1), 300);
$bbox$;

grant execute on function public.list_echoes_in_bbox(double precision, double precision, double precision, double precision, int) to authenticated;

-- get_echo
create or replace function public.get_echo(p_echo_id uuid)
returns table (
  id uuid, owner_id uuid, author_name text, avatar_type text, avatar_url text,
  kind text, visibility text, media_path text, cover_path text,
  lat double precision, lon double precision,
  voice_filter text, sense_filter text, allow_comments boolean, share_on_profile boolean,
  label text, title text, city_label text, place_label text, created_at timestamptz,
  discover_radius_m double precision, browse_globally boolean, expires_at timestamptz,
  aura_count bigint, i_gave_aura boolean
)
language sql security definer set search_path = public stable
as $get$
  select e.id, e.owner_id, coalesce(p.silly_name, 'a fren'), coalesce(p.avatar_type, 'frog'), p.avatar_url,
    e.kind, e.visibility, e.media_path, e.cover_path, e.lat, e.lon,
    e.voice_filter, e.sense_filter, e.allow_comments, e.share_on_profile,
    e.label, e.title, e.city_label, e.place_label, e.created_at,
    e.discover_radius_m, e.browse_globally, e.expires_at,
    (select count(*) from public.echo_reactions r where r.echo_id = e.id),
    exists (select 1 from public.echo_reactions r where r.echo_id = e.id and r.user_id = auth.uid())
  from public.echoes e
  left join public.profiles p on p.id = e.owner_id
  where e.id = p_echo_id
    and e.hidden = false
    and (e.expires_at is null or e.expires_at > now())
    and (
      e.owner_id = auth.uid()
      or e.visibility = 'world'
      or (
        e.visibility = 'friends'
        and (
          exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid() and f.following_id = e.owner_id
          )
          or exists (
            select 1 from public.follows f
            where f.follower_id = e.owner_id and f.following_id = auth.uid()
          )
        )
      )
    )
  limit 1;
$get$;

grant execute on function public.get_echo(uuid) to authenticated;

notify pgrst, 'reload schema';
