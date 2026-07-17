-- Echo Map — image echoes + audio cover images
-- Safe to re-run. Run in Supabase → SQL Editor.

alter table public.echoes
  add column if not exists cover_path text;

alter table public.echoes drop constraint if exists echoes_kind_check;
alter table public.echoes add constraint echoes_kind_check
  check (kind in ('audio', 'video', 'image'));

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
  p_city_label text default null,
  p_expires_at timestamptz default null,
  p_cover_path text default null
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
  if p_kind not in ('audio', 'video', 'image') then raise exception 'Invalid kind'; end if;
  if p_visibility not in ('world', 'friends', 'private') then raise exception 'Invalid visibility'; end if;
  if p_media_path is null or p_media_path = '' then raise exception 'Missing media'; end if;
  if strpos(p_media_path, uid::text || '/') <> 1 then raise exception 'Invalid media path'; end if;
  if p_cover_path is not null and p_cover_path <> '' and strpos(p_cover_path, uid::text || '/') <> 1 then
    raise exception 'Invalid cover path';
  end if;

  insert into public.echoes (
    owner_id, kind, visibility, media_path, cover_path, lat, lon,
    voice_filter, sense_filter, allow_comments, share_on_profile,
    label, city_label, expires_at
  )
  values (
    uid, p_kind, p_visibility, p_media_path,
    nullif(trim(p_cover_path), ''),
    p_lat, p_lon,
    p_voice_filter, p_sense_filter, coalesce(p_allow_comments, false),
    coalesce(p_share_on_profile, true),
    nullif(trim(p_label), ''), nullif(trim(p_city_label), ''), p_expires_at
  )
  returning id into new_id;

  return new_id;
end;
$$;

drop function if exists public.list_echoes_near(double precision, double precision, double precision);

create or replace function public.list_echoes_near(
  p_lat double precision,
  p_lon double precision,
  p_radius_m double precision default 2500
)
returns table (
  id uuid,
  owner_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  kind text,
  visibility text,
  media_path text,
  cover_path text,
  lat double precision,
  lon double precision,
  voice_filter text,
  sense_filter text,
  allow_comments boolean,
  share_on_profile boolean,
  label text,
  city_label text,
  created_at timestamptz,
  distance_m double precision
)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.id,
    e.owner_id,
    coalesce(p.silly_name, 'a fren') as author_name,
    coalesce(p.avatar_type, 'frog') as avatar_type,
    p.avatar_url,
    e.kind,
    e.visibility,
    e.media_path,
    e.cover_path,
    e.lat,
    e.lon,
    e.voice_filter,
    e.sense_filter,
    e.allow_comments,
    e.share_on_profile,
    e.label,
    e.city_label,
    e.created_at,
    public.echo_distance_m(p_lat, p_lon, e.lat, e.lon) as distance_m
  from public.echoes e
  left join public.profiles p on p.id = e.owner_id
  where e.hidden = false
    and e.visibility in ('world', 'friends')
    and (e.expires_at is null or e.expires_at > now())
    and public.echo_distance_m(p_lat, p_lon, e.lat, e.lon) <= p_radius_m
  order by distance_m asc
  limit 200;
$$;

grant execute on function public.publish_echo(text, text, text, double precision, double precision, text, text, boolean, boolean, text, text, timestamptz, text) to authenticated;
grant execute on function public.list_echoes_near(double precision, double precision, double precision) to authenticated;

notify pgrst, 'reload schema';
