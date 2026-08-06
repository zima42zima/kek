-- ⚠️ SUPERSEDED — do not re-run. Redefines sync_cave / list_my_caves.
-- Use supabase-caves.sql + supabase-patch-cave-cover-publish.sql instead. See CAVES.md.
--
-- Cave cover photos: persist on sync + reload in list_my_caves.
-- Safe to re-run. Run in Supabase → SQL Editor after cave base patches.
-- Also run supabase-patch-cave-covers.sql if you have not yet (column + set_cave_cover).

alter table public.caves add column if not exists cover_url text;

create or replace function public.set_cave_cover(
  p_cave_id text,
  p_cover_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_cave_id is null or length(trim(p_cave_id)) = 0 then
    raise exception 'Cave id required';
  end if;
  if not public.is_cave_keeper(p_cave_id, uid) then
    raise exception 'Only cave keepers can set cover';
  end if;

  update public.caves
  set cover_url = nullif(trim(p_cover_url), ''),
      updated_at = now()
  where id = p_cave_id;
end;
$$;

grant execute on function public.set_cave_cover(text, text) to authenticated;

-- sync_cave: keepers can persist coverUrl from the client snapshot.
create or replace function public.sync_cave(p_cave jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid text := p_cave->>'id';
  owner_id uuid := coalesce((p_cave->>'ownerId')::uuid, uid);
  mem jsonb;
  mem_id uuid;
  roster uuid[] := array[owner_id];
  is_owner boolean := (uid = owner_id);
  roles_in jsonb := p_cave->'roles';
  cover_in text := nullif(trim(coalesce(p_cave->>'coverUrl', p_cave->>'cover_url', '')), '');
  has_cover_key boolean := (p_cave ? 'coverUrl') or (p_cave ? 'cover_url');
  keeper boolean;
begin
  if uid is null or cid is null then
    raise exception 'Not authenticated';
  end if;

  keeper := public.is_cave_keeper(cid, uid);

  insert into public.caves (id, owner_id, name, emoji, access, banned, emoji_packs, roles, cover_url, updated_at)
  values (
    cid,
    owner_id,
    coalesce(p_cave->>'name', 'cave'),
    coalesce(p_cave->>'emoji', '🕳️'),
    coalesce(p_cave->>'access', 'invite'),
    coalesce(
      (
        select array_agg(x::uuid)
        from jsonb_array_elements_text(coalesce(p_cave->'banned', '[]'::jsonb)) as t(x)
        where x ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ),
      '{}'::uuid[]
    ),
    coalesce(p_cave->'emojiPacks', '[]'::jsonb),
    case when jsonb_typeof(roles_in) = 'array' then roles_in else null end,
    case when keeper and has_cover_key then cover_in else null end,
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    emoji = excluded.emoji,
    access = case when caves.owner_id = uid then excluded.access else caves.access end,
    banned = case when caves.owner_id = uid then excluded.banned else caves.banned end,
    emoji_packs = case when caves.owner_id = uid then excluded.emoji_packs else caves.emoji_packs end,
    roles = case
      when caves.owner_id = uid and jsonb_typeof(roles_in) = 'array' then roles_in
      else caves.roles
    end,
    cover_url = case
      when keeper and has_cover_key then cover_in
      else caves.cover_url
    end,
    updated_at = now();

  insert into public.cave_members (cave_id, user_id, role)
  values (cid, uid, case when owner_id = uid then 'owner' else 'member' end)
  on conflict (cave_id, user_id) do nothing;

  if is_owner then
    for mem in select value from jsonb_array_elements(coalesce(p_cave->'members', '[]'::jsonb))
    loop
      begin
        mem_id := (mem->>'id')::uuid;
        roster := array_append(roster, mem_id);
        insert into public.cave_members (cave_id, user_id, role)
        values (cid, mem_id, coalesce(mem->>'role', 'member'))
        on conflict (cave_id, user_id) do update set role = excluded.role;
      exception when others then
        continue;
      end;
    end loop;

    select coalesce(array_agg(distinct x), array[owner_id]) into roster
    from unnest(roster) as x;

    delete from public.cave_memberships
    where cave_id = cid and not (user_id = any(roster));

    delete from public.cave_members
    where cave_id = cid and not (user_id = any(roster));
  end if;
end;
$$;

grant execute on function public.sync_cave(jsonb) to authenticated;

-- list_my_caves must return coverUrl or covers vanish after refresh.
-- Matches supabase-patch-live-avatars.sql (includes coverUrl + live avatars).
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

grant execute on function public.list_my_caves() to authenticated;

comment on column public.caves.cover_url is 'Optional cover image URL for cave list/detail preview.';
