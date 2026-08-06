-- Cave chat avatars: prefer live profile photo, fall back to snapshot on the message.
-- Fixes joiners losing the other fren's photo after refresh when profiles.avatar_url
-- is empty but cave_messages.avatar_url still has the URL from send time.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- list_cave_messages
-- ---------------------------------------------------------------------------
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
    coalesce(nullif(pr.avatar_type, ''), nullif(m.avatar_type, ''), 'frog') as avatar_type,
    coalesce(nullif(pr.avatar_url, ''), nullif(m.avatar_url, '')) as avatar_url,
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

revoke all on function public.list_cave_messages(text) from public;
revoke all on function public.list_cave_messages(text) from anon;
grant execute on function public.list_cave_messages(text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_cave
-- ---------------------------------------------------------------------------
drop function if exists public.get_cave(text);

create or replace function public.get_cave(p_cave_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_cave_obj jsonb;
  v_keeper boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_cave_id is null or length(trim(p_cave_id)) = 0 then
    raise exception 'Cave id required';
  end if;

  if not exists (
    select 1 from public.cave_members cm
    where cm.cave_id = p_cave_id and cm.user_id = v_uid
  ) then
    raise exception 'Not a member of this cave';
  end if;

  v_keeper := public.is_cave_keeper(p_cave_id, v_uid);

  select jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'emoji', c.emoji,
    'ownerId', c.owner_id,
    'access', c.access,
    'coverUrl', c.cover_url,
    'roles', c.roles,
    'banned', to_jsonb(coalesce(c.banned, '{}'::uuid[])),
    'emojiPacks', coalesce(c.emoji_packs, '[]'::jsonb),
    'hiddenOnProfile', coalesce(my.hidden_on_profile, false),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cm2.user_id,
        'name', coalesce(pr.silly_name, 'a fren'),
        'avatarType', coalesce(pr.avatar_type, 'frog'),
        'avatarUrl', pr.avatar_url,
        'role', cm2.role
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
        'avatarType', coalesce(nullif(pr_m.avatar_type, ''), nullif(m.avatar_type, ''), 'frog'),
        'avatarUrl', coalesce(nullif(pr_m.avatar_url, ''), nullif(m.avatar_url, '')),
        'text', m.body,
        'image', m.image,
        'sticker', m.sticker,
        'pinned', coalesce(m.pinned, false),
        'hidden', coalesce(m.hidden, false),
        'parentId', m.parent_id,
        'createdAt', m.created_at,
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
        and (v_keeper or not coalesce(m.hidden, false))
    ), '[]'::jsonb)
  ) into v_cave_obj
  from public.caves c
  join public.cave_members my on my.cave_id = c.id and my.user_id = v_uid
  where c.id = p_cave_id;

  return coalesce(v_cave_obj, 'null'::jsonb);
end;
$$;

revoke all on function public.get_cave(text) from public;
revoke all on function public.get_cave(text) from anon;
grant execute on function public.get_cave(text) to authenticated;

-- ---------------------------------------------------------------------------
-- list_my_caves (same coalesce on message avatars)
-- ---------------------------------------------------------------------------
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
          'avatarType', coalesce(nullif(pr_m.avatar_type, ''), nullif(m.avatar_type, ''), 'frog'),
          'avatarUrl', coalesce(nullif(pr_m.avatar_url, ''), nullif(m.avatar_url, '')),
          'text', m.body,
          'image', m.image,
          'sticker', m.sticker,
          'pinned', coalesce(m.pinned, false),
          'hidden', coalesce(m.hidden, false),
          'parentId', m.parent_id,
          'createdAt', m.created_at,
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

revoke all on function public.list_my_caves() from public;
revoke all on function public.list_my_caves() from anon;
grant execute on function public.list_my_caves() to authenticated;

notify pgrst, 'reload schema';
