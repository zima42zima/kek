-- STEP 2a: publish_echo (run after browse-1-columns)
drop function if exists public.publish_echo(
  text, text, text, double precision, double precision,
  text, text, boolean, boolean, text, text, timestamptz, text
);
drop function if exists public.publish_echo(
  text, text, text, double precision, double precision,
  text, text, boolean, boolean, text, text, timestamptz, text, double precision
);
drop function if exists public.publish_echo(
  text, text, text, double precision, double precision,
  text, text, boolean, boolean, text, text, timestamptz, text, double precision, text, boolean
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
  insert into public.echoes (
    owner_id, kind, visibility, media_path, cover_path, lat, lon,
    voice_filter, sense_filter, allow_comments, share_on_profile,
    label, city_label, place_label, expires_at, discover_radius_m, browse_globally
  )
  values (
    uid, p_kind, p_visibility, p_media_path, nullif(trim(p_cover_path), ''),
    p_lat, p_lon, p_voice_filter, p_sense_filter, coalesce(p_allow_comments, false),
    coalesce(p_share_on_profile, true), nullif(trim(p_label), ''), nullif(trim(p_city_label), ''),
    nullif(trim(p_place_label), ''), p_expires_at, radius_m, browse_global
  )
  returning id into new_id;
  return new_id;
end;
$publish$;

grant execute on function public.publish_echo(
  text, text, text, double precision, double precision,
  text, text, boolean, boolean, text, text, timestamptz, text, double precision, text, boolean
) to authenticated;
