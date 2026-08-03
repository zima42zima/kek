-- Echo Map — minimal backend (v1)
-- Safe to re-run. Paste ALL of this into Supabase → SQL Editor → Run.
-- Run AFTER your other patches (owl, rabbit, etc.).

-- 1) One table for echoes
create table if not exists public.echoes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users on delete cascade not null,
  kind text not null check (kind in ('audio', 'video')),
  visibility text not null default 'world' check (visibility in ('world', 'friends', 'private')),
  media_path text not null,
  lat double precision not null,
  lon double precision not null,
  voice_filter text,
  sense_filter text,
  allow_comments boolean not null default false,
  share_on_profile boolean not null default true,
  label text,
  city_label text,
  expires_at timestamptz,
  hidden boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists echoes_owner_idx on public.echoes (owner_id, created_at desc);
create index if not exists echoes_map_idx on public.echoes (visibility, created_at desc)
  where hidden = false and visibility <> 'private';

grant select, insert, update, delete on public.echoes to authenticated;
alter table public.echoes enable row level security;

-- Owners see all their echoes; others only see public ones (app still does proximity rules).
drop policy if exists "Owners manage own echoes" on public.echoes;
create policy "Owners manage own echoes"
  on public.echoes for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Public echoes readable" on public.echoes;
create policy "Public echoes readable"
  on public.echoes for select to authenticated
  using (
    hidden = false
    and visibility in ('world', 'friends')
    and (expires_at is null or expires_at > now())
  );

-- 2) Private storage for audio/video (not base64 in the DB)
insert into storage.buckets (id, name, public)
values ('echo-media', 'echo-media', false)
on conflict (id) do nothing;

drop policy if exists "Users upload own echo media" on storage.objects;
create policy "Users upload own echo media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'echo-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users read own echo media" on storage.objects;
create policy "Users read own echo media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'echo-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own echo media" on storage.objects;
create policy "Users delete own echo media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'echo-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) Notifications — echo events
alter table public.notifications
  add column if not exists echo_id uuid references public.echoes(id) on delete cascade;

alter table public.notifications
  add column if not exists echo_city_label text;

-- Haversine distance in metres (Postgres, no extensions).
create or replace function public.echo_distance_m(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
)
returns double precision
language sql immutable as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;

-- Publish an echo (call after uploading file to echo-media bucket).
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
  p_expires_at timestamptz default null
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
  if p_kind not in ('audio', 'video') then raise exception 'Invalid kind'; end if;
  if p_visibility not in ('world', 'friends', 'private') then raise exception 'Invalid visibility'; end if;
  if p_media_path is null or p_media_path = '' then raise exception 'Missing media'; end if;
  if strpos(p_media_path, uid::text || '/') <> 1 then raise exception 'Invalid media path'; end if;

  insert into public.echoes (
    owner_id, kind, visibility, media_path, lat, lon,
    voice_filter, sense_filter, allow_comments, share_on_profile,
    label, city_label, expires_at
  )
  values (
    uid, p_kind, p_visibility, p_media_path, p_lat, p_lon,
    p_voice_filter, p_sense_filter, coalesce(p_allow_comments, false),
    coalesce(p_share_on_profile, true),
    nullif(trim(p_label), ''), nullif(trim(p_city_label), ''), p_expires_at
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- Echoes near you (app filters friends-only + discovery radius).
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

create or replace function public.delete_echo(p_echo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.echoes where id = p_echo_id and owner_id = uid;
end;
$$;

create or replace function public.list_my_echoes()
returns setof public.echoes
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.echoes
  where owner_id = auth.uid()
  order by created_at desc
  limit 200;
$$;

-- 4) Extend notification feed
drop function if exists public.list_notifications();

create or replace function public.list_notifications()
returns table (
  id uuid,
  type text,
  actor_id uuid,
  actor_name text,
  actor_avatar_type text,
  actor_avatar_url text,
  post_id uuid,
  post_preview text,
  cave_id text,
  cave_name text,
  conversation_id uuid,
  dm_preview text,
  rabbit_topic_id uuid,
  rabbit_preview text,
  owl_letter_id uuid,
  owl_letter_anonymous boolean,
  echo_id uuid,
  echo_city_label text,
  read boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    n.id,
    n.type,
    case
      when n.type = 'owl_letter' and (n.owl_letter_anonymous or coalesce(ol.anonymous, false)) then null
      else n.actor_id
    end as actor_id,
    case
      when n.type = 'owl_letter' and (n.owl_letter_anonymous or coalesce(ol.anonymous, false)) then null
      else coalesce(pr.silly_name, 'a fren')
    end as actor_name,
    case
      when n.type = 'owl_letter' and (n.owl_letter_anonymous or coalesce(ol.anonymous, false)) then null
      else coalesce(pr.avatar_type, 'frog')
    end as actor_avatar_type,
    case
      when n.type = 'owl_letter' and (n.owl_letter_anonymous or coalesce(ol.anonymous, false)) then null
      else pr.avatar_url
    end as actor_avatar_url,
    n.post_id,
    left(coalesce(po.body, ''), 80) as post_preview,
    n.cave_id,
    n.cave_name,
    n.conversation_id,
    n.dm_preview,
    n.rabbit_topic_id,
    n.rabbit_preview,
    n.owl_letter_id,
    (n.type = 'owl_letter' and (n.owl_letter_anonymous or coalesce(ol.anonymous, false))) as owl_letter_anonymous,
    n.echo_id,
    n.echo_city_label,
    n.read,
    n.created_at
  from public.notifications n
  left join public.owl_letters ol on ol.id = n.owl_letter_id
  left join public.profiles pr on pr.id = n.actor_id
  left join public.posts po on po.id = n.post_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit 100;
$$;

grant execute on function public.publish_echo(text, text, text, double precision, double precision, text, text, boolean, boolean, text, text, timestamptz) to authenticated;
grant execute on function public.list_echoes_near(double precision, double precision, double precision) to authenticated;
grant execute on function public.delete_echo(uuid) to authenticated;
grant execute on function public.list_my_echoes() to authenticated;
grant execute on function public.list_notifications() to authenticated;

notify pgrst, 'reload schema';
