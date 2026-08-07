-- Echo anonymity in notifications + opt-in echo publish alerts.
-- Safe to re-run.
--
-- 1) Anonymous echoes never put your name/avatar on notifications.
-- 2) Echo publish pings are OFF by default; frens opt in via Settings.

alter table public.profiles
  add column if not exists notify_echo_publishes boolean not null default false;

-- Notify followers only when they opted in; scrub actor when echo is anonymous.
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
    case when coalesce(new.anonymous, false) then null else new.owner_id end,
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

-- Scrub older anonymous echo notifications that already leaked actor_id.
update public.notifications n
set actor_id = null
from public.echoes e
where n.echo_id = e.id
  and n.type in ('echo', 'echo_follow', 'echo_published', 'echo_friends')
  and coalesce(e.anonymous, false) = true
  and n.actor_id is not null;

-- list_notifications: hide echo actor when echo.anonymous; keep echo + platform columns.
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
  platform_report_id uuid,
  echo_id uuid,
  echo_city_label text,
  echo_anonymous boolean,
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
      when n.type in ('echo', 'echo_follow', 'echo_published', 'echo_friends')
        and coalesce(e.anonymous, false) then null
      else n.actor_id
    end as actor_id,
    case
      when n.type = 'owl_letter' and (n.owl_letter_anonymous or coalesce(ol.anonymous, false)) then null
      when n.type in ('echo', 'echo_follow', 'echo_published', 'echo_friends')
        and coalesce(e.anonymous, false) then 'a fren'
      else coalesce(pr.silly_name, 'a fren')
    end as actor_name,
    case
      when n.type = 'owl_letter' and (n.owl_letter_anonymous or coalesce(ol.anonymous, false)) then null
      when n.type in ('echo', 'echo_follow', 'echo_published', 'echo_friends')
        and coalesce(e.anonymous, false) then 'frog'
      else coalesce(pr.avatar_type, 'frog')
    end as actor_avatar_type,
    case
      when n.type = 'owl_letter' and (n.owl_letter_anonymous or coalesce(ol.anonymous, false)) then null
      when n.type in ('echo', 'echo_follow', 'echo_published', 'echo_friends')
        and coalesce(e.anonymous, false) then null
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
    n.platform_report_id,
    n.echo_id,
    n.echo_city_label,
    (
      n.type in ('echo', 'echo_follow', 'echo_published', 'echo_friends')
      and coalesce(e.anonymous, false)
    ) as echo_anonymous,
    n.read,
    n.created_at
  from public.notifications n
  left join public.owl_letters ol on ol.id = n.owl_letter_id
  left join public.echoes e on e.id = n.echo_id
  left join public.profiles pr on pr.id = n.actor_id
  left join public.posts po on po.id = n.post_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit 100;
$$;

grant execute on function public.list_notifications() to authenticated;

notify pgrst, 'reload schema';
