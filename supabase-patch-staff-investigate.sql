-- Staff investigation — founders & co-founders can review an account like the user can
-- (profile, posts, DMs, reports) when deciding suspend / action.
-- Requires: supabase-patch-platform-moderation.sql + DMs + posts.
-- Safe to re-run.

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
as $$
begin
  if not public.am_i_platform_staff() then
    raise exception 'Staff only';
  end if;
  if p_user is null then
    raise exception 'No user';
  end if;

  return query
  select
    p.id as user_id,
    nullif(trim(p.fren_handle), '') as handle,
    coalesce(nullif(trim(p.silly_name), ''), 'a fren') as name,
    p.one_human_thing,
    p.bio,
    coalesce(p.avatar_type, 'frog') as avatar_type,
    p.avatar_url,
    coalesce(p.is_founder, false) as is_founder,
    coalesce(p.is_cofounder, false) as is_cofounder,
    (p.suspended_at is not null) as suspended,
    p.suspended_reason,
    p.suspended_at,
    p.created_at,
    (select count(*) from public.posts po where po.user_id = p.id) as post_count,
    (select count(*) from public.follows f where f.following_id = p.id) as follower_count,
    (select count(*) from public.follows f where f.follower_id = p.id) as following_count,
    (
      select count(*) from public.dm_conversations c
      where c.user_a = p.id or c.user_b = p.id
    ) as dm_thread_count,
    (
      select count(*) from public.platform_reports pr
      where pr.reported_user_id = p.id and pr.status = 'open'
    ) as open_report_count
  from public.profiles p
  where p.id = p_user;
end;
$$;

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
as $$
begin
  if not public.am_i_platform_staff() then
    raise exception 'Staff only';
  end if;

  return query
  select
    po.id,
    po.body,
    po.image,
    po.audience,
    po.created_at
  from public.posts po
  where po.user_id = p_user
  order by po.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
end;
$$;

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
as $$
begin
  if not public.am_i_platform_staff() then
    raise exception 'Staff only';
  end if;

  return query
  select
    c.id as conversation_id,
    case when c.user_a = p_user then c.user_b else c.user_a end as other_user_id,
    coalesce(pr.silly_name, 'a fren') as other_name,
    nullif(trim(pr.fren_handle), '') as other_handle,
    lm.body as last_body,
    coalesce(lm.created_at, c.updated_at) as last_at,
    (
      select count(*) from public.dm_messages m where m.conversation_id = c.id
    ) as message_count
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
$$;

create or replace function public.staff_list_dm_messages(p_conversation_id uuid)
returns table (
  id bigint,
  sender_id uuid,
  author_name text,
  body text,
  image text,
  video text,
  sticker text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.am_i_platform_staff() then
    raise exception 'Staff only';
  end if;
  if p_conversation_id is null then
    raise exception 'No conversation';
  end if;

  return query
  select
    m.id,
    m.sender_id,
    m.author_name,
    m.body,
    m.image,
    m.video,
    m.sticker,
    m.created_at
  from public.dm_messages m
  where m.conversation_id = p_conversation_id
  order by m.created_at asc
  limit 500;
end;
$$;

create or replace function public.staff_list_user_reports(p_user uuid)
returns table (
  id uuid,
  kind text,
  ref_id text,
  preview text,
  reason text,
  status text,
  reporter_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.am_i_platform_staff() then
    raise exception 'Staff only';
  end if;

  return query
  select
    pr.id,
    pr.kind,
    pr.ref_id,
    pr.preview,
    pr.reason,
    pr.status,
    coalesce(rp.silly_name, 'a fren') as reporter_name,
    pr.created_at
  from public.platform_reports pr
  left join public.profiles rp on rp.id = pr.reporter_id
  where pr.reported_user_id = p_user
  order by pr.created_at desc
  limit 50;
end;
$$;

grant execute on function public.staff_get_user_dossier(uuid) to authenticated;
grant execute on function public.staff_list_user_posts(uuid, int) to authenticated;
grant execute on function public.staff_list_user_dm_threads(uuid) to authenticated;
grant execute on function public.staff_list_dm_messages(uuid) to authenticated;
grant execute on function public.staff_list_user_reports(uuid) to authenticated;

notify pgrst, 'reload schema';
