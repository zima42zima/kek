-- Cave message replies (threads) + parent_id on messages.
-- Safe to re-run. Run in Supabase → SQL Editor after cave messages exist.

alter table public.cave_messages
  add column if not exists parent_id bigint references public.cave_messages(id) on delete set null;

create index if not exists cave_messages_parent_idx
  on public.cave_messages (cave_id, parent_id)
  where parent_id is not null;

-- send_cave_message with optional parent
create or replace function public.send_cave_message(
  p_cave_id text,
  p_body text default null,
  p_image text default null,
  p_sticker text default null,
  p_author_name text default null,
  p_avatar_type text default 'frog',
  p_avatar_url text default null,
  p_parent_id bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mid bigint;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.cave_members where cave_id = p_cave_id and user_id = uid
  ) then
    raise exception 'Not a cave member';
  end if;

  if p_parent_id is not null and not exists (
    select 1 from public.cave_messages
    where id = p_parent_id and cave_id = p_cave_id
  ) then
    raise exception 'Parent message not found';
  end if;

  insert into public.cave_messages (
    cave_id, author_id, author_name, avatar_type, avatar_url, body, image, sticker, parent_id
  )
  values (
    p_cave_id, uid, p_author_name, coalesce(p_avatar_type, 'frog'), p_avatar_url,
    nullif(p_body, ''), p_image, p_sticker, p_parent_id
  )
  returning id into mid;

  update public.caves set updated_at = now() where id = p_cave_id;
  return mid;
end;
$$;

grant execute on function public.send_cave_message(text, text, text, text, text, text, text, bigint) to authenticated;

-- list_my_caves messages include parent_id + short reply preview
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
      'hiddenOnProfile', coalesce(c.hidden_on_profile, false),
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
          'authorName', m.author_name,
          'avatarType', m.avatar_type,
          'avatarUrl', m.avatar_url,
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
