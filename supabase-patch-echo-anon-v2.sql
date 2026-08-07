-- Echo anonymity v2: World-only, bat for everyone else, no publish notifs,
-- hide owner_id from non-owners (staff still see it), never share on profile.
-- Safe to re-run. Supersedes drop-anonymous redaction stubs.
-- Run after echo-anonymous / anon-notify / platform-moderation patches.

alter table public.echoes
  add column if not exists anonymous boolean not null default false;

-- Redact author fields for anonymous echoes (not the owner).
create or replace function public.echo_public_author_name(p_owner uuid, p_anonymous boolean, p_name text)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when coalesce(p_anonymous, false) and p_owner is distinct from auth.uid() then 'a fren'
    else coalesce(nullif(trim(p_name), ''), 'a fren')
  end;
$$;

create or replace function public.echo_public_avatar_type(p_owner uuid, p_anonymous boolean, p_type text)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when coalesce(p_anonymous, false) and p_owner is distinct from auth.uid() then 'frog'
    else coalesce(nullif(trim(p_type), ''), 'frog')
  end;
$$;

create or replace function public.echo_public_avatar_url(p_owner uuid, p_anonymous boolean, p_url text)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when coalesce(p_anonymous, false) and p_owner is distinct from auth.uid() then null
    else p_url
  end;
$$;

-- Hide owner_id from everyone except the owner and platform staff.
create or replace function public.echo_public_owner_id(p_owner uuid, p_anonymous boolean)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not coalesce(p_anonymous, false) then p_owner
    when p_owner is not distinct from auth.uid() then p_owner
    when public.am_i_platform_staff() then p_owner
    else null
  end;
$$;

grant execute on function public.echo_public_author_name(uuid, boolean, text) to authenticated;
grant execute on function public.echo_public_avatar_type(uuid, boolean, text) to authenticated;
grant execute on function public.echo_public_avatar_url(uuid, boolean, text) to authenticated;
grant execute on function public.echo_public_owner_id(uuid, boolean) to authenticated;

-- publish_echo: anon forces World + never share on profile
drop function if exists public.publish_echo(
  text, text, text, double precision, double precision,
  text, text, boolean, boolean, text, text, text, timestamptz, text, double precision, text, boolean
);
drop function if exists public.publish_echo(
  text, text, text, double precision, double precision,
  text, text, boolean, boolean, text, text, text, timestamptz, text, double precision, text, boolean, boolean
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
  p_browse_globally boolean default false,
  p_anonymous boolean default false
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
  is_anon boolean := coalesce(p_anonymous, false);
  vis text := p_visibility;
  share_profile boolean;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_kind not in ('audio', 'video', 'image') then raise exception 'Invalid kind'; end if;
  if vis not in ('world', 'friends', 'private') then raise exception 'Invalid visibility'; end if;
  if is_anon then
    vis := 'world';
  end if;
  if p_media_path is null or p_media_path = '' then raise exception 'Missing media'; end if;
  if strpos(p_media_path, uid::text || '/') <> 1 then raise exception 'Invalid media path'; end if;
  if p_cover_path is not null and p_cover_path <> '' and strpos(p_cover_path, uid::text || '/') <> 1 then raise exception 'Invalid cover path'; end if;
  radius_m := coalesce(p_discover_radius_m, 800);
  if radius_m < 420 or radius_m > 2500 then raise exception 'Discover radius must be between 420m and 2500m'; end if;
  browse_global := coalesce(p_browse_globally, false) and vis = 'world';
  clean_title := nullif(left(trim(coalesce(p_title, '')), 222), '');
  share_profile := case when is_anon then false else coalesce(p_share_on_profile, true) end;
  insert into public.echoes (
    owner_id, kind, visibility, media_path, cover_path, lat, lon,
    voice_filter, sense_filter, allow_comments, share_on_profile,
    label, title, city_label, place_label, expires_at, discover_radius_m, browse_globally,
    anonymous
  )
  values (
    uid, p_kind, vis, p_media_path, nullif(trim(p_cover_path), ''),
    p_lat, p_lon, p_voice_filter, p_sense_filter, coalesce(p_allow_comments, false),
    share_profile, nullif(trim(p_label), ''), clean_title,
    nullif(trim(p_city_label), ''),
    nullif(trim(p_place_label), ''), p_expires_at, radius_m, browse_global,
    is_anon
  )
  returning id into new_id;
  return new_id;
end;
$publish$;

grant execute on function public.publish_echo(
  text, text, text, double precision, double precision,
  text, text, boolean, boolean, text, text, text, timestamptz, text, double precision, text, boolean, boolean
) to authenticated;

-- No publish notifications for anonymous echoes.
create or replace function public.tg_notify_echo_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if coalesce(new.anonymous, false) then
    return new;
  end if;
  if new.visibility not in ('world', 'friends') then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, type, echo_id, echo_city_label)
  select
    f.fren_id,
    new.owner_id,
    case when new.visibility = 'friends' then 'echo_friends' else 'echo_published' end,
    new.id,
    nullif(trim(new.city_label), '')
  from (
    select f1.follower_id as fren_id
    from public.follows f1
    where f1.following_id = new.owner_id
    union
    select f2.following_id as fren_id
    from public.follows f2
    where f2.follower_id = new.owner_id
  ) f
  join public.profiles pr on pr.id = f.fren_id
  where f.fren_id <> new.owner_id
    and coalesce(pr.notify_echo_publishes, false) = true;

  return new;
end;
$fn$;

drop trigger if exists on_echo_published on public.echoes;
create trigger on_echo_published
  after insert on public.echoes
  for each row execute function public.tg_notify_echo_published();

-- List / get RPCs: redact author + null owner_id for anon non-owners.
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
  browse_globally boolean, expires_at timestamptz, aura_count bigint, i_gave_aura boolean,
  anonymous boolean
)
language sql security definer set search_path = public stable
as $near$
  select e.id,
    public.echo_public_owner_id(e.owner_id, e.anonymous),
    public.echo_public_author_name(e.owner_id, e.anonymous, p.silly_name),
    public.echo_public_avatar_type(e.owner_id, e.anonymous, p.avatar_type),
    public.echo_public_avatar_url(e.owner_id, e.anonymous, p.avatar_url),
    e.kind, e.visibility, e.media_path, e.cover_path, e.lat, e.lon,
    e.voice_filter, e.sense_filter, e.allow_comments, e.share_on_profile,
    e.label, e.title, e.city_label, e.place_label, e.created_at,
    public.echo_distance_m(p_lat, p_lon, e.lat, e.lon), e.discover_radius_m, e.browse_globally, e.expires_at,
    (select count(*) from public.echo_reactions r where r.echo_id = e.id),
    exists (select 1 from public.echo_reactions r where r.echo_id = e.id and r.user_id = auth.uid()),
    e.anonymous
  from public.echoes e
  left join public.profiles p on p.id = e.owner_id
  where e.hidden = false and e.visibility in ('world', 'friends')
    and (e.expires_at is null or e.expires_at > now())
    and public.echo_distance_m(p_lat, p_lon, e.lat, e.lon) <= least(p_radius_m, 2500)
  order by public.echo_distance_m(p_lat, p_lon, e.lat, e.lon) asc limit 200;
$near$;

grant execute on function public.list_echoes_near(double precision, double precision, double precision) to authenticated;

drop function if exists public.list_echoes_in_bbox(double precision, double precision, double precision, double precision, integer);
drop function if exists public.list_echoes_in_bbox(double precision, double precision, double precision, double precision, int);

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
  aura_count bigint, i_gave_aura boolean, anonymous boolean
)
language sql security definer set search_path = public stable
as $bbox$
  select e.id,
    public.echo_public_owner_id(e.owner_id, e.anonymous),
    public.echo_public_author_name(e.owner_id, e.anonymous, p.silly_name),
    public.echo_public_avatar_type(e.owner_id, e.anonymous, p.avatar_type),
    public.echo_public_avatar_url(e.owner_id, e.anonymous, p.avatar_url),
    e.kind, e.visibility, e.media_path, e.cover_path, e.lat, e.lon,
    e.voice_filter, e.sense_filter, e.allow_comments, e.share_on_profile,
    e.label, e.title, e.city_label, e.place_label, e.created_at,
    e.discover_radius_m, e.browse_globally, e.expires_at,
    (select count(*) from public.echo_reactions r where r.echo_id = e.id),
    exists (select 1 from public.echo_reactions r where r.echo_id = e.id and r.user_id = auth.uid()),
    e.anonymous
  from public.echoes e
  left join public.profiles p on p.id = e.owner_id
  where e.hidden = false and e.visibility = 'world' and e.browse_globally = true
    and (e.expires_at is null or e.expires_at > now())
    and e.lat between p_south and p_north and e.lon between p_west and p_east
  order by e.created_at desc
  limit least(greatest(coalesce(p_limit, 150), 1), 300);
$bbox$;

grant execute on function public.list_echoes_in_bbox(double precision, double precision, double precision, double precision, int) to authenticated;

drop function if exists public.get_echo(uuid);

create or replace function public.get_echo(p_echo_id uuid)
returns table (
  id uuid, owner_id uuid, author_name text, avatar_type text, avatar_url text,
  kind text, visibility text, media_path text, cover_path text,
  lat double precision, lon double precision,
  voice_filter text, sense_filter text, allow_comments boolean, share_on_profile boolean,
  label text, title text, city_label text, place_label text, created_at timestamptz,
  discover_radius_m double precision, browse_globally boolean, expires_at timestamptz,
  aura_count bigint, i_gave_aura boolean, anonymous boolean
)
language sql security definer set search_path = public stable
as $get$
  select e.id,
    public.echo_public_owner_id(e.owner_id, e.anonymous),
    public.echo_public_author_name(e.owner_id, e.anonymous, p.silly_name),
    public.echo_public_avatar_type(e.owner_id, e.anonymous, p.avatar_type),
    public.echo_public_avatar_url(e.owner_id, e.anonymous, p.avatar_url),
    e.kind, e.visibility, e.media_path, e.cover_path, e.lat, e.lon,
    e.voice_filter, e.sense_filter, e.allow_comments, e.share_on_profile,
    e.label, e.title, e.city_label, e.place_label, e.created_at,
    e.discover_radius_m, e.browse_globally, e.expires_at,
    (select count(*) from public.echo_reactions r where r.echo_id = e.id),
    exists (select 1 from public.echo_reactions r where r.echo_id = e.id and r.user_id = auth.uid()),
    e.anonymous
  from public.echoes e
  left join public.profiles p on p.id = e.owner_id
  where e.id = p_echo_id and e.hidden = false
    and (e.expires_at is null or e.expires_at > now() or e.owner_id = auth.uid());
$get$;

grant execute on function public.get_echo(uuid) to authenticated;

-- Keep list_my_echoes returning anonymous + real owner (owner-only).
drop function if exists public.list_my_echoes();

create or replace function public.list_my_echoes()
returns table (
  id uuid, owner_id uuid, kind text, visibility text, media_path text, cover_path text,
  lat double precision, lon double precision, voice_filter text, sense_filter text,
  allow_comments boolean, share_on_profile boolean, label text, title text, city_label text, place_label text,
  expires_at timestamptz, hidden boolean, created_at timestamptz,
  discover_radius_m double precision, browse_globally boolean, aura_count bigint, i_gave_aura boolean,
  anonymous boolean
)
language sql security definer set search_path = public stable
as $mine$
  select e.id, e.owner_id, e.kind, e.visibility, e.media_path, e.cover_path,
    e.lat, e.lon, e.voice_filter, e.sense_filter, e.allow_comments, e.share_on_profile,
    e.label, e.title, e.city_label, e.place_label, e.expires_at, e.hidden, e.created_at,
    e.discover_radius_m, e.browse_globally,
    (select count(*) from public.echo_reactions r where r.echo_id = e.id),
    exists (select 1 from public.echo_reactions r where r.echo_id = e.id and r.user_id = auth.uid()),
    e.anonymous
  from public.echoes e
  where e.owner_id = auth.uid()
  order by e.created_at desc limit 200;
$mine$;

grant execute on function public.list_my_echoes() to authenticated;

-- Scrub any leftover anon publish notifications.
delete from public.notifications n
using public.echoes e
where n.echo_id = e.id
  and n.type in ('echo', 'echo_follow', 'echo_published', 'echo_friends')
  and coalesce(e.anonymous, false) = true;

notify pgrst, 'reload schema';
