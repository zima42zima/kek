-- Show current profile photo on DMs, caves, echo comments (not snapshot at send time).
-- Safe to re-run. Run after dm-reactions, cave-roles / cave-message-replies, echo-comments.

-- ─── DMs ─────────────────────────────────────────────────────────────────────

drop function if exists public.list_dm_messages(uuid);
create or replace function public.list_dm_messages(p_conversation_id uuid)
returns table (
  id bigint,
  sender_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  image text,
  video text,
  sticker text,
  created_at timestamptz,
  reactions jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    m.id,
    m.sender_id,
    coalesce(pr.silly_name, m.author_name, 'a fren') as author_name,
    coalesce(pr.avatar_type, 'frog') as avatar_type,
    pr.avatar_url as avatar_url,
    m.body, m.image, m.video, m.sticker, m.created_at,
    public.dm_message_reactions_json(m.id) as reactions
  from public.dm_messages m
  join public.dm_conversations c on c.id = m.conversation_id
  left join public.profiles pr on pr.id = m.sender_id
  where m.conversation_id = p_conversation_id
    and (c.user_a = auth.uid() or c.user_b = auth.uid())
  order by m.created_at asc
  limit 500;
$$;

grant execute on function public.list_dm_messages(uuid) to authenticated;

-- ─── Cave messages ───────────────────────────────────────────────────────────

drop function if exists public.list_cave_messages(text);
create or replace function public.list_cave_messages(p_cave_id text)
returns table (
  id bigint,
  author_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  image text,
  sticker text,
  created_at timestamptz,
  pinned boolean,
  hidden boolean,
  parent_id bigint,
  reply_preview jsonb,
  reactions jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    m.id,
    m.author_id,
    coalesce(pr.silly_name, m.author_name, 'a fren') as author_name,
    coalesce(pr.avatar_type, 'frog') as avatar_type,
    pr.avatar_url as avatar_url,
    m.body, m.image, m.sticker, m.created_at,
    coalesce(m.pinned, false),
    coalesce(m.hidden, false),
    m.parent_id,
    case
      when m.parent_id is null then null
      else (
        select jsonb_build_object(
          'authorName', coalesce(p.author_name, 'a fren'),
          'text', left(coalesce(p.body, ''), 120)
        )
        from public.cave_messages p
        where p.id = m.parent_id
      )
    end as reply_preview,
    public.cave_message_reactions_json(m.id) as reactions
  from public.cave_messages m
  left join public.profiles pr on pr.id = m.author_id
  where m.cave_id = p_cave_id
    and exists (
      select 1 from public.cave_members cm
      where cm.cave_id = p_cave_id and cm.user_id = auth.uid()
    )
    and (public.is_cave_keeper(p_cave_id) or not coalesce(m.hidden, false))
  order by m.created_at asc
  limit 500;
$$;

grant execute on function public.list_cave_messages(text) to authenticated;

-- list_my_caves: live avatars on embedded messages
create or replace function public.list_my_caves()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
  result jsonb := '[]'::jsonb;
  cid text;
  cave_obj jsonb;
  keeper boolean;
begin
  if uid is null then return '[]'::jsonb; end if;

  for cid in
    select cm.cave_id from public.cave_members cm where cm.user_id = uid
  loop
    keeper := public.is_cave_keeper(cid, uid);

    select jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'emoji', c.emoji,
      'ownerId', c.owner_id,
      'access', c.access,
      'coverUrl', c.cover_url,
      'roles', c.roles,
      'banned', coalesce(c.banned, '[]'::jsonb),
      'emojiPacks', coalesce(c.emoji_packs, '[]'::jsonb),
      'hiddenOnProfile', coalesce(my.hidden_on_profile, c.hidden_on_profile, false),
      'members', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', cm2.user_id,
          'name', coalesce(pr.silly_name, 'a fren'),
          'avatarType', coalesce(pr.avatar_type, 'frog'),
          'avatarUrl', pr.avatar_url,
          'role', cm2.role,
          'funTitle', coalesce(cm2.fun_title, 'dweller'),
          'titleExpiresAt', cm2.title_expires_at,
          'modRole', cm2.mod_role,
          'modExpiresAt', cm2.mod_expires_at
        ) order by cm2.joined_at)
        from public.cave_members cm2
        left join public.profiles pr on pr.id = cm2.user_id
        where cm2.cave_id = c.id
      ), '[]'::jsonb),
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', m.id,
          'authorId', m.author_id,
          'authorName', coalesce(pr_m.silly_name, m.author_name, 'a fren'),
          'avatarType', coalesce(pr_m.avatar_type, 'frog'),
          'avatarUrl', pr_m.avatar_url,
          'text', m.body,
          'image', m.image,
          'sticker', m.sticker,
          'pinned', coalesce(m.pinned, false),
          'hidden', coalesce(m.hidden, false),
          'parentId', m.parent_id,
          'replyPreview', case
            when m.parent_id is null then null
            else (
              select jsonb_build_object(
                'authorName', coalesce(p.author_name, 'a fren'),
                'text', left(coalesce(p.body, ''), 120)
              )
              from public.cave_messages p
              where p.id = m.parent_id
            )
          end,
          'reactions', public.cave_message_reactions_json(m.id),
          'ts', case
            when m.created_at > now() - interval '45 seconds' then 'just now'
            when m.created_at > now() - interval '1 hour' then floor(extract(epoch from (now() - m.created_at)) / 60)::text || 'm'
            when m.created_at > now() - interval '1 day' then floor(extract(epoch from (now() - m.created_at)) / 3600)::text || 'h'
            else to_char(m.created_at, 'Mon DD')
          end
        ) order by m.created_at)
        from public.cave_messages m
        left join public.profiles pr_m on pr_m.id = m.author_id
        where m.cave_id = c.id
          and (keeper or not coalesce(m.hidden, false))
      ), '[]'::jsonb)
    ) into cave_obj
    from public.caves c
    join public.cave_members my on my.cave_id = c.id and my.user_id = uid
    where c.id = cid;

    result := result || jsonb_build_array(cave_obj);
  end loop;

  return result;
end;
$$;

grant execute on function public.list_my_caves() to authenticated;

-- ─── Echo comments ───────────────────────────────────────────────────────────

create or replace function public.list_echo_comments(p_echo uuid)
returns table (
  id uuid,
  echo_id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    c.echo_id,
    c.user_id,
    coalesce(pr.silly_name, c.author_name, 'a fren') as author_name,
    coalesce(pr.avatar_type, 'frog') as avatar_type,
    pr.avatar_url as avatar_url,
    c.body,
    c.created_at
  from public.echo_comments c
  join public.echoes e on e.id = c.echo_id
  left join public.profiles pr on pr.id = c.user_id
  where c.echo_id = p_echo
    and e.hidden = false
    and (e.expires_at is null or e.expires_at > now())
    and (
      e.owner_id = auth.uid()
      or e.visibility = 'world'
      or e.visibility = 'friends'
    )
  order by c.created_at asc
  limit 200;
$$;

grant execute on function public.list_echo_comments(uuid) to authenticated;

-- ─── Rabbit hole (skip anonymous; match rabbit-hole-v2 shapes) ────────────────

drop function if exists public.list_rabbit_replies(uuid);
create or replace function public.list_rabbit_replies(p_topic uuid)
returns table (
  id uuid,
  topic_id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  anonymous boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id,
    r.topic_id,
    r.user_id,
    case
      when coalesce(r.anonymous, false) then coalesce(r.author_name, 'a fren')
      else coalesce(pr.silly_name, r.author_name, 'a fren')
    end as author_name,
    case
      when coalesce(r.anonymous, false) then 'frog'
      else coalesce(pr.avatar_type, 'frog')
    end as avatar_type,
    case
      when coalesce(r.anonymous, false) then null
      else pr.avatar_url
    end as avatar_url,
    r.body,
    coalesce(r.anonymous, false) as anonymous,
    r.created_at
  from public.rabbit_replies r
  left join public.profiles pr on pr.id = r.user_id
  where r.topic_id = p_topic
    and (coalesce(r.hidden, false) = false or public.am_i_rabbit_mod())
  order by r.created_at asc
  limit 300;
$$;

drop function if exists public.list_rabbit_topics(text, text);
create or replace function public.list_rabbit_topics(
  p_sort text default 'new',
  p_tag text default null
)
returns table (
  id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  title text,
  body text,
  tag text,
  pinned boolean,
  anonymous boolean,
  hidden boolean,
  created_at timestamptz,
  updated_at timestamptz,
  reply_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id,
    t.user_id,
    case
      when coalesce(t.anonymous, false) then coalesce(t.author_name, 'a fren')
      else coalesce(pr.silly_name, t.author_name, 'a fren')
    end as author_name,
    case
      when coalesce(t.anonymous, false) then 'frog'
      else coalesce(pr.avatar_type, 'frog')
    end as avatar_type,
    case
      when coalesce(t.anonymous, false) then null
      else pr.avatar_url
    end as avatar_url,
    t.title,
    t.body,
    t.tag,
    coalesce(t.pinned, false) as pinned,
    coalesce(t.anonymous, false) as anonymous,
    coalesce(t.hidden, false) as hidden,
    t.created_at,
    t.updated_at,
    (select count(*) from public.rabbit_replies r where r.topic_id = t.id and coalesce(r.hidden, false) = false) as reply_count
  from public.rabbit_topics t
  left join public.profiles pr on pr.id = t.user_id
  where (
    coalesce(t.hidden, false) = false
    or public.am_i_rabbit_mod()
  )
  and (p_tag is null or nullif(trim(p_tag), '') is null or t.tag = p_tag)
  order by
    coalesce(t.pinned, false) desc,
    case
      when p_sort = 'new' then t.created_at
      else t.updated_at
    end desc,
    case when p_sort = 'hot' then (
      select count(*) from public.rabbit_replies r where r.topic_id = t.id and coalesce(r.hidden, false) = false
    ) else 0 end desc,
    t.created_at desc
  limit 100;
$$;

drop function if exists public.get_rabbit_topic(uuid);
create or replace function public.get_rabbit_topic(p_id uuid)
returns table (
  id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  title text,
  body text,
  tag text,
  pinned boolean,
  anonymous boolean,
  hidden boolean,
  created_at timestamptz,
  updated_at timestamptz,
  reply_count bigint,
  i_follow boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id,
    t.user_id,
    case
      when coalesce(t.anonymous, false) then coalesce(t.author_name, 'a fren')
      else coalesce(pr.silly_name, t.author_name, 'a fren')
    end as author_name,
    case
      when coalesce(t.anonymous, false) then 'frog'
      else coalesce(pr.avatar_type, 'frog')
    end as avatar_type,
    case
      when coalesce(t.anonymous, false) then null
      else pr.avatar_url
    end as avatar_url,
    t.title,
    t.body,
    t.tag,
    coalesce(t.pinned, false) as pinned,
    coalesce(t.anonymous, false) as anonymous,
    coalesce(t.hidden, false) as hidden,
    t.created_at,
    t.updated_at,
    (select count(*) from public.rabbit_replies r where r.topic_id = t.id and coalesce(r.hidden, false) = false) as reply_count,
    exists (
      select 1 from public.rabbit_topic_follows f
      where f.topic_id = t.id and f.user_id = auth.uid()
    ) as i_follow
  from public.rabbit_topics t
  left join public.profiles pr on pr.id = t.user_id
  where t.id = p_id
    and (coalesce(t.hidden, false) = false or public.am_i_rabbit_mod());
$$;

grant execute on function public.list_rabbit_replies(uuid) to authenticated;
grant execute on function public.list_rabbit_topics(text, text) to authenticated;
grant execute on function public.get_rabbit_topic(uuid) to authenticated;

notify pgrst, 'reload schema';
