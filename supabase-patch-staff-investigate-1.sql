-- Staff investigation PART 1/2 — dossier + posts + DM threads
-- Run this whole file, then part 2. Safe to re-run.
-- Requires: supabase-patch-platform-moderation.sql

create or replace function public.staff_get_user_dossier(p_user uuid)
returns table (
  user_id uuid,
  handle text,
  name text,
  one_human_thing text,
  bio text,
  avatar_type text,
  avatar_url text,
  is_founder boolean,
  is_cofounder boolean,
  suspended boolean,
  suspended_reason text,
  suspended_at timestamptz,
  created_at timestamptz,
  post_count bigint,
  follower_count bigint,
  following_count bigint,
  dm_thread_count bigint,
  open_report_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $fn$
begin
  if not public.am_i_platform_staff() then
    raise exception 'Staff only';
  end if;
  if p_user is null then
    raise exception 'No user';
  end if;

  return query
  select
    p.id,
    nullif(trim(p.fren_handle), ''),
    coalesce(nullif(trim(p.silly_name), ''), 'a fren'),
    p.one_human_thing,
    p.bio,
    coalesce(p.avatar_type, 'frog'),
    p.avatar_url,
    coalesce(p.is_founder, false),
    coalesce(p.is_cofounder, false),
    (p.suspended_at is not null),
    p.suspended_reason,
    p.suspended_at,
    p.created_at,
    (select count(*) from public.posts po where po.user_id = p.id),
    (select count(*) from public.follows f where f.following_id = p.id),
    (select count(*) from public.follows f where f.follower_id = p.id),
    (select count(*) from public.dm_conversations c where c.user_a = p.id or c.user_b = p.id),
    (select count(*) from public.platform_reports pr where pr.reported_user_id = p.id and pr.status = 'open')
  from public.profiles p
  where p.id = p_user;
end;
$fn$;

create or replace function public.staff_list_user_posts(p_user uuid, p_limit int default 40)
returns table (
  id uuid,
  body text,
  image text,
  audience text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $fn$
begin
  if not public.am_i_platform_staff() then
    raise exception 'Staff only';
  end if;

  return query
  select po.id, po.body, po.image, po.audience, po.created_at
  from public.posts po
  where po.user_id = p_user
  order by po.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
end;
$fn$;

create or replace function public.staff_list_user_dm_threads(p_user uuid)
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_name text,
  other_handle text,
  last_body text,
  last_at timestamptz,
  message_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $fn$
begin
  if not public.am_i_platform_staff() then
    raise exception 'Staff only';
  end if;

  return query
  select
    c.id,
    case when c.user_a = p_user then c.user_b else c.user_a end,
    coalesce(pr.silly_name, 'a fren'),
    nullif(trim(pr.fren_handle), ''),
    lm.body,
    coalesce(lm.created_at, c.updated_at),
    (select count(*) from public.dm_messages m where m.conversation_id = c.id)
  from public.dm_conversations c
  left join public.profiles pr
    on pr.id = case when c.user_a = p_user then c.user_b else c.user_a end
  left join lateral (
    select m.body, m.created_at
    from public.dm_messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where c.user_a = p_user or c.user_b = p_user
  order by coalesce(lm.created_at, c.updated_at) desc
  limit 100;
end;
$fn$;
