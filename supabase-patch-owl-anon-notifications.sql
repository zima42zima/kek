-- Owl Post — anonymous notification privacy (v2)
-- Safe to re-run. Run ALL of this in Supabase → SQL Editor.

alter table public.notifications
  add column if not exists owl_letter_anonymous boolean not null default false;

-- Persist anonymity on the notification row itself (no join required).
create or replace function public.send_owl_letter(
  p_to uuid,
  p_body text,
  p_anonymous boolean default false,
  p_from_display text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s public.owl_settings%rowtype;
  new_id uuid;
  initial_status text;
  display_name text;
  is_anon boolean := coalesce(p_anonymous, false);
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(p_body), '') is null then raise exception 'Letter cannot be empty'; end if;
  if not public.can_send_owl_to(p_to) then raise exception 'This fren is not accepting letters'; end if;

  select * into s from public.owl_settings where user_id = p_to;

  if is_anon and not s.accept_anonymous then
    raise exception 'This fren does not accept anonymous letters';
  end if;

  display_name := case
    when is_anon then 'anonymous fren'
    else coalesce(nullif(trim(p_from_display), ''), 'a fren')
  end;

  initial_status := case
    when s.require_preapproval then 'pending'
    else 'ready'
  end;

  insert into public.owl_letters (from_user, to_user, anonymous, from_display, body, status, approved_at)
  values (
    uid,
    p_to,
    is_anon,
    display_name,
    trim(p_body),
    initial_status,
    case when initial_status = 'ready' then now() else null end
  )
  returning id into new_id;

  insert into public.notifications (user_id, actor_id, type, owl_letter_id, owl_letter_anonymous)
  values (
    p_to,
    case when is_anon then null else uid end,
    'owl_letter',
    new_id,
    is_anon
  );

  return new_id;
end;
$$;

-- Backfill older anonymous owl notifications.
update public.notifications n
set
  actor_id = null,
  owl_letter_anonymous = true
from public.owl_letters l
where n.owl_letter_id = l.id
  and n.type = 'owl_letter'
  and l.anonymous;

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

grant execute on function public.send_owl_letter(uuid, text, boolean, text) to authenticated;
grant execute on function public.list_notifications() to authenticated;

notify pgrst, 'reload schema';
