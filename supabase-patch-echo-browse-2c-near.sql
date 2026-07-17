-- STEP 2c: list_echoes_near (run after 2b)

drop function if exists public.list_echoes_near(double precision, double precision, double precision);

create or replace function public.list_echoes_near(
  p_lat double precision, p_lon double precision, p_radius_m double precision default 2500
)
returns table (
  id uuid, owner_id uuid, author_name text, avatar_type text, avatar_url text,
  kind text, visibility text, media_path text, cover_path text,
  lat double precision, lon double precision,
  voice_filter text, sense_filter text, allow_comments boolean, share_on_profile boolean,
  label text, city_label text, place_label text, created_at timestamptz,
  distance_m double precision, discover_radius_m double precision,
  browse_globally boolean, expires_at timestamptz, aura_count bigint, i_gave_aura boolean
)
language sql security definer set search_path = public stable
as $near$
  select e.id, e.owner_id, coalesce(p.silly_name, 'a fren'), coalesce(p.avatar_type, 'frog'), p.avatar_url,
    e.kind, e.visibility, e.media_path, e.cover_path, e.lat, e.lon,
    e.voice_filter, e.sense_filter, e.allow_comments, e.share_on_profile,
    e.label, e.city_label, e.place_label, e.created_at,
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
