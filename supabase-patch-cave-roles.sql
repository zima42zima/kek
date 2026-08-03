-- Cave fun titles + light keeper tools. Safe to re-run.

alter table public.cave_members add column if not exists fun_title text default 'dweller';
alter table public.cave_members add column if not exists title_expires_at timestamptz;
alter table public.cave_members add column if not exists mod_role text;
alter table public.cave_members add column if not exists mod_expires_at timestamptz;

alter table public.cave_messages add column if not exists pinned boolean default false;
alter table public.cave_messages add column if not exists hidden boolean default false;

create or replace function public.is_cave_keeper(p_cave_id text, p_user uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.caves c
    where c.id = p_cave_id and c.owner_id = p_user
  ) or exists (
    select 1 from public.cave_members cm
    where cm.cave_id = p_cave_id and cm.user_id = p_user
      and (
        cm.mod_role = 'keeper'
        or (cm.mod_role = 'co_keeper' and (cm.mod_expires_at is null or cm.mod_expires_at > now()))
      )
  );
$$;

create or replace function public.assign_cave_title(
  p_cave_id text,
  p_target uuid,
  p_title_id text,
  p_weeks int default 2
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not public.is_cave_keeper(p_cave_id, uid) then
    raise exception 'Only cave keepers can assign titles';
  end if;
  if not exists (
    select 1 from public.cave_members where cave_id = p_cave_id and user_id = p_target
  ) then raise exception 'Not a cave member'; end if;

  update public.cave_members set
    fun_title = coalesce(nullif(p_title_id, ''), 'dweller'),
    title_expires_at = case
      when coalesce(p_title_id, 'dweller') = 'dweller' then null
      when p_weeks is null or p_weeks <= 0 then now() + interval '2 weeks'
      else now() + (p_weeks || ' weeks')::interval
    end
  where cave_id = p_cave_id and user_id = p_target;
end;
$$;

create or replace function public.assign_cave_mod_role(
  p_cave_id text,
  p_target uuid,
  p_mod_role text,
  p_weeks int default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
  owner uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select owner_id into owner from public.caves where id = p_cave_id;
  if owner is null then raise exception 'Cave not found'; end if;
  if uid <> owner and not public.is_cave_keeper(p_cave_id, uid) then
    raise exception 'Only the owner or keepers can assign mod roles';
  end if;
  if p_target = owner and p_mod_role is not null then
    raise exception 'Owner is already the cave keeper';
  end if;

  update public.cave_members set
    mod_role = nullif(p_mod_role, ''),
    mod_expires_at = case
      when nullif(p_mod_role, '') is null then null
      when p_mod_role = 'keeper' then null
      when p_weeks is null or p_weeks <= 0 then now() + interval '1 week'
      else now() + (p_weeks || ' weeks')::interval
    end
  where cave_id = p_cave_id and user_id = p_target;
end;
$$;

create or replace function public.toggle_cave_message_pin(p_cave_id text, p_message_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
  new_pinned boolean;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not public.is_cave_keeper(p_cave_id, uid) then
    raise exception 'Only cave keepers can pin messages';
  end if;
  update public.cave_messages set pinned = not coalesce(pinned, false)
  where id = p_message_id and cave_id = p_cave_id
  returning pinned into new_pinned;
  if new_pinned is null then raise exception 'Message not found'; end if;
  return new_pinned;
end;
$$;

create or replace function public.hide_cave_message(p_cave_id text, p_message_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not public.is_cave_keeper(p_cave_id, uid) then
    raise exception 'Only cave keepers can hide messages';
  end if;
  update public.cave_messages set hidden = true
  where id = p_message_id and cave_id = p_cave_id;
end;
$$;

-- Rebuild list_my_caves with titles + pin/hide on messages.
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
    order by (select c.updated_at from public.caves c where c.id = cm.cave_id) desc
  loop
    keeper := public.is_cave_keeper(cid, uid);
    select jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'emoji', c.emoji,
      'ownerId', c.owner_id,
      'access', c.access,
      'banned', to_jsonb(coalesce(c.banned, '{}'::uuid[])),
      'emojiPacks', coalesce(c.emoji_packs, '[]'::jsonb),
      'hiddenOnProfile', coalesce(my.hidden_on_profile, false),
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

grant execute on function public.is_cave_keeper(text, uuid) to authenticated;
grant execute on function public.assign_cave_title(text, uuid, text, int) to authenticated;
grant execute on function public.assign_cave_mod_role(text, uuid, text, int) to authenticated;
grant execute on function public.toggle_cave_message_pin(text, bigint) to authenticated;
grant execute on function public.hide_cave_message(text, bigint) to authenticated;
grant execute on function public.list_my_caves() to authenticated;

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
  reactions jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select m.id, m.author_id, m.author_name, m.avatar_type, m.avatar_url,
         m.body, m.image, m.sticker, m.created_at,
         coalesce(m.pinned, false), coalesce(m.hidden, false),
         public.cave_message_reactions_json(m.id) as reactions
  from public.cave_messages m
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

notify pgrst, 'reload schema';
