-- STEP 2b: explore map RPCs (run after 2a)

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
  label text, city_label text, place_label text, created_at timestamptz,
  discover_radius_m double precision, browse_globally boolean, expires_at timestamptz,
  aura_count bigint, i_gave_aura boolean
)
language sql security definer set search_path = public stable
as $bbox$
  select e.id, e.owner_id, coalesce(p.silly_name, 'a fren'), coalesce(p.avatar_type, 'frog'), p.avatar_url,
    e.kind, e.visibility, e.media_path, e.cover_path, e.lat, e.lon,
    e.voice_filter, e.sense_filter, e.allow_comments, e.share_on_profile,
    e.label, e.city_label, e.place_label, e.created_at,
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

create or replace function public.search_echo_places(p_query text, p_limit int default 40)
returns table (place_key text, place_label text, city_label text, lat double precision, lon double precision, echo_count bigint)
language sql security definer set search_path = public stable
as $places$
  with tagged as (
    select coalesce(nullif(trim(e.place_label), ''), nullif(trim(e.city_label), ''), 'unknown') as place_key,
      coalesce(nullif(trim(e.place_label), ''), nullif(trim(e.city_label), '')) as place_label,
      e.city_label, e.lat, e.lon
    from public.echoes e
    where e.hidden = false and e.visibility = 'world' and e.browse_globally = true
      and (e.expires_at is null or e.expires_at > now())
      and (coalesce(e.place_label, '') ilike '%' || trim(p_query) || '%'
        or coalesce(e.city_label, '') ilike '%' || trim(p_query) || '%')
  )
  select t.place_key, t.place_label, t.city_label,
    avg(t.lat)::double precision, avg(t.lon)::double precision, count(*)::bigint
  from tagged t
  group by t.place_key, t.place_label, t.city_label
  order by count(*) desc, t.place_key asc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$places$;

grant execute on function public.list_echoes_in_bbox(double precision, double precision, double precision, double precision, int) to authenticated;
grant execute on function public.search_echo_places(text, int) to authenticated;
