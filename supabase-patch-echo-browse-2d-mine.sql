-- STEP 2d: list_my_echoes + reload (run after 2c)

drop function if exists public.list_my_echoes();

create or replace function public.list_my_echoes()
returns table (
  id uuid, owner_id uuid, kind text, visibility text, media_path text, cover_path text,
  lat double precision, lon double precision, voice_filter text, sense_filter text,
  allow_comments boolean, share_on_profile boolean, label text, city_label text, place_label text,
  expires_at timestamptz, hidden boolean, created_at timestamptz,
  discover_radius_m double precision, browse_globally boolean, aura_count bigint, i_gave_aura boolean
)
language sql security definer set search_path = public stable
as $mine$
  select e.id, e.owner_id, e.kind, e.visibility, e.media_path, e.cover_path,
    e.lat, e.lon, e.voice_filter, e.sense_filter, e.allow_comments, e.share_on_profile,
    e.label, e.city_label, e.place_label, e.expires_at, e.hidden, e.created_at,
    e.discover_radius_m, e.browse_globally,
    (select count(*) from public.echo_reactions r where r.echo_id = e.id),
    exists (select 1 from public.echo_reactions r where r.echo_id = e.id and r.user_id = auth.uid())
  from public.echoes e
  where e.owner_id = auth.uid()
  order by e.created_at desc limit 200;
$mine$;

grant execute on function public.list_my_echoes() to authenticated;

notify pgrst, 'reload schema';
