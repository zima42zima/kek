-- Echo aura — reactions + notifications (mirrors post aura).
-- Safe to re-run. Run in Supabase → SQL Editor.

create table if not exists public.echo_reactions (
  echo_id uuid references public.echoes(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  primary key (echo_id, user_id)
);

grant select, insert, delete on public.echo_reactions to authenticated;
alter table public.echo_reactions enable row level security;

drop policy if exists "Echo reactions viewable" on public.echo_reactions;
create policy "Echo reactions viewable"
  on public.echo_reactions for select to authenticated using (true);

drop policy if exists "Users add own echo reactions" on public.echo_reactions;
create policy "Users add own echo reactions"
  on public.echo_reactions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users remove own echo reactions" on public.echo_reactions;
create policy "Users remove own echo reactions"
  on public.echo_reactions for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists echo_reactions_echo_idx on public.echo_reactions (echo_id);

create or replace function public.toggle_echo_aura(p_echo uuid)
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
    select 1 from public.echo_reactions where echo_id = p_echo and user_id = uid
  ) into had;

  if had then
    delete from public.echo_reactions where echo_id = p_echo and user_id = uid;
  else
    insert into public.echo_reactions (echo_id, user_id)
    values (p_echo, uid)
    on conflict do nothing;
  end if;

  return query
    select
      (select count(*) from public.echo_reactions where echo_id = p_echo),
      (not had);
end;
$$;

create or replace function public.tg_notify_echo_aura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare owner uuid;
begin
  select e.owner_id into owner from public.echoes e where e.id = new.echo_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, echo_id)
    values (owner, new.user_id, 'echo_aura', new.echo_id);
  end if;
  return new;
end;
$$;

create or replace function public.tg_unnotify_echo_aura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare owner uuid;
begin
  select e.owner_id into owner from public.echoes e where e.id = old.echo_id;
  if owner is not null then
    delete from public.notifications
    where type = 'echo_aura'
      and user_id = owner
      and actor_id = old.user_id
      and echo_id = old.echo_id;
  end if;
  return old;
end;
$$;

drop trigger if exists on_echo_aura_created on public.echo_reactions;
create trigger on_echo_aura_created
  after insert on public.echo_reactions
  for each row execute function public.tg_notify_echo_aura();

drop trigger if exists on_echo_aura_removed on public.echo_reactions;
create trigger on_echo_aura_removed
  after delete on public.echo_reactions
  for each row execute function public.tg_unnotify_echo_aura();

-- Include aura state in nearby echo list.
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
  distance_m double precision,
  aura_count bigint,
  i_gave_aura boolean
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
    public.echo_distance_m(p_lat, p_lon, e.lat, e.lon) as distance_m,
    (select count(*) from public.echo_reactions r where r.echo_id = e.id) as aura_count,
    exists (
      select 1 from public.echo_reactions r
      where r.echo_id = e.id and r.user_id = auth.uid()
    ) as i_gave_aura
  from public.echoes e
  left join public.profiles p on p.id = e.owner_id
  where e.hidden = false
    and e.visibility in ('world', 'friends')
    and (e.expires_at is null or e.expires_at > now())
    and public.echo_distance_m(p_lat, p_lon, e.lat, e.lon) <= p_radius_m
  order by distance_m asc
  limit 200;
$$;

drop function if exists public.list_my_echoes();

create or replace function public.list_my_echoes()
returns table (
  id uuid,
  owner_id uuid,
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
  expires_at timestamptz,
  hidden boolean,
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
    e.id,
    e.owner_id,
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
    e.expires_at,
    e.hidden,
    e.created_at,
    (select count(*) from public.echo_reactions r where r.echo_id = e.id) as aura_count,
    false as i_gave_aura
  from public.echoes e
  where e.owner_id = auth.uid()
  order by e.created_at desc
  limit 200;
$$;

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

grant execute on function public.toggle_echo_aura(uuid) to authenticated;
grant execute on function public.list_echoes_near(double precision, double precision, double precision) to authenticated;
grant execute on function public.list_my_echoes() to authenticated;
grant execute on function public.list_notifications() to authenticated;

notify pgrst, 'reload schema';
