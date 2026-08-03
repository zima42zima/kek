-- Echo publish — notify followers + enable Realtime
-- Safe to re-run. Run AFTER echo-browse patches.

create or replace function public.tg_notify_echo_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
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
  where f.fren_id <> new.owner_id;

  return new;
end;
$fn$;

drop trigger if exists on_echo_published on public.echoes;
create trigger on_echo_published
  after insert on public.echoes
  for each row execute function public.tg_notify_echo_published();

alter table public.echoes replica identity full;

-- Fetch a single echo the viewer is allowed to see (notification deep-link / refresh).
create or replace function public.get_echo(p_echo_id uuid)
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
as $get$
  select e.id, e.owner_id, coalesce(p.silly_name, 'a fren'), coalesce(p.avatar_type, 'frog'), p.avatar_url,
    e.kind, e.visibility, e.media_path, e.cover_path, e.lat, e.lon,
    e.voice_filter, e.sense_filter, e.allow_comments, e.share_on_profile,
    e.label, e.city_label, e.place_label, e.created_at,
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

do $$
begin
  alter publication supabase_realtime add table public.echoes;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
