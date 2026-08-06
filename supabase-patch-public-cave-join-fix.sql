-- ⚠️ SUPERSEDED — merged into supabase-caves.sql. Prefer the foundation file.
-- See CAVES.md.
--
-- Fix public cave joins: keep joiners through owner sync, return full cave, notify owner.
-- Safe to re-run. Run in Supabase → SQL Editor after supabase-patch-public-caves-search.sql.
--
-- SAFETY (read this):
-- • Does NOT create any tables.
-- • Does NOT change RLS policies on caves / cave_members / notifications.
-- • Does NOT delete cave rows, messages, or members.
-- • DROP FUNCTION only replaces RPC definitions (no user data deleted).
-- • Functions stay SECURITY DEFINER + auth.uid() checks; execute granted to authenticated only.
-- If Supabase warns about a table named like a variable, that is a false positive — Cancel and
-- re-paste this file (variables use v_ prefixes). Prefer "Run without RLS" only if that table
-- warning still appears; never invent a new public table for this patch.

-- ---------------------------------------------------------------------------
-- sync_cave: upsert members only. Never delete joiners missing from client roster.
-- Kicks/bans stay on remove_cave_member (unchanged).
-- ---------------------------------------------------------------------------
create or replace function public.sync_cave(p_cave jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cave_id text := p_cave->>'id';
  v_owner_id uuid := coalesce((p_cave->>'ownerId')::uuid, v_uid);
  v_mem jsonb;
  v_mem_id uuid;
  v_is_owner boolean := (v_uid = v_owner_id);
  v_roles_in jsonb := p_cave->'roles';
  v_cover_in text := nullif(trim(coalesce(p_cave->>'coverUrl', p_cave->>'cover_url', '')), '');
  v_has_cover_key boolean := (p_cave ? 'coverUrl') or (p_cave ? 'cover_url');
  v_keeper boolean;
begin
  if v_uid is null or v_cave_id is null then
    raise exception 'Not authenticated';
  end if;

  v_keeper := public.is_cave_keeper(v_cave_id, v_uid);

  insert into public.caves (id, owner_id, name, emoji, access, banned, emoji_packs, roles, cover_url, updated_at)
  values (
    v_cave_id,
    v_owner_id,
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
    case when jsonb_typeof(v_roles_in) = 'array' then v_roles_in else null end,
    case when v_keeper and v_has_cover_key then v_cover_in else null end,
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    emoji = excluded.emoji,
    access = case when caves.owner_id = v_uid then excluded.access else caves.access end,
    banned = case when caves.owner_id = v_uid then excluded.banned else caves.banned end,
    emoji_packs = case when caves.owner_id = v_uid then excluded.emoji_packs else caves.emoji_packs end,
    roles = case
      when caves.owner_id = v_uid and jsonb_typeof(v_roles_in) = 'array' then v_roles_in
      else caves.roles
    end,
    cover_url = case
      when v_keeper and v_has_cover_key then v_cover_in
      else caves.cover_url
    end,
    updated_at = now();

  insert into public.cave_members (cave_id, user_id, role)
  values (v_cave_id, v_uid, case when v_owner_id = v_uid then 'owner' else 'member' end)
  on conflict (cave_id, user_id) do nothing;

  -- Owner may upsert members from the client snapshot, but never remove others here.
  if v_is_owner then
    for v_mem in select value from jsonb_array_elements(coalesce(p_cave->'members', '[]'::jsonb))
    loop
      begin
        v_mem_id := (v_mem->>'id')::uuid;
        insert into public.cave_members (cave_id, user_id, role)
        values (v_cave_id, v_mem_id, coalesce(v_mem->>'role', 'member'))
        on conflict (cave_id, user_id) do update set role = excluded.role;
      exception when others then
        continue;
      end;
    end loop;
  end if;
end;
$$;

revoke all on function public.sync_cave(jsonb) from public;
revoke all on function public.sync_cave(jsonb) from anon;
grant execute on function public.sync_cave(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- search_public_caves: include cover_url (signature change requires replace).
-- ---------------------------------------------------------------------------
drop function if exists public.search_public_caves(text);

create or replace function public.search_public_caves(p_query text default null)
returns table (
  cave_id text,
  name text,
  emoji text,
  owner_id uuid,
  member_count bigint,
  i_member boolean,
  cover_url text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_needle text := nullif(trim(coalesce(p_query, '')), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    c.id as cave_id,
    c.name,
    coalesce(c.emoji, '🕳️') as emoji,
    c.owner_id,
    (select count(*)::bigint from public.cave_members cm where cm.cave_id = c.id) as member_count,
    exists (
      select 1 from public.cave_members m
      where m.cave_id = c.id and m.user_id = v_uid
    ) as i_member,
    c.cover_url
  from public.caves c
  where c.access = 'public'
    and not (v_uid = any (coalesce(c.banned, '{}'::uuid[])))
    and (
      v_needle is null
      or c.name ilike '%' || v_needle || '%'
    )
  order by c.updated_at desc nulls last, c.created_at desc nulls last
  limit 40;
end;
$$;

revoke all on function public.search_public_caves(text) from public;
revoke all on function public.search_public_caves(text) from anon;
grant execute on function public.search_public_caves(text) to authenticated;

-- ---------------------------------------------------------------------------
-- join_public_cave: membership + owner notify + full cave payload for joiner.
-- Return type changed (void -> jsonb), so DROP FUNCTION is required once.
-- ---------------------------------------------------------------------------
drop function if exists public.join_public_cave(text);

create or replace function public.join_public_cave(p_cave_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_access text;
  v_owner uuid;
  v_banned uuid[];
  v_name text;
  v_emoji text;
  v_cover text;
  v_inserted_count integer := 0;
  v_cave_obj jsonb;
  v_keeper boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_cave_id is null or length(trim(p_cave_id)) = 0 then
    raise exception 'Cave id required';
  end if;

  select c.access, c.owner_id, coalesce(c.banned, '{}'::uuid[]), c.name, coalesce(c.emoji, '🕳️'), c.cover_url
    into v_access, v_owner, v_banned, v_name, v_emoji, v_cover
  from public.caves c
  where c.id = p_cave_id;

  if v_owner is null then
    raise exception 'Cave not found';
  end if;
  if v_access is distinct from 'public' then
    raise exception 'This cave is not public';
  end if;
  if v_uid = any (v_banned) then
    raise exception 'You cannot join this cave';
  end if;

  insert into public.cave_members (cave_id, user_id, role)
  values (p_cave_id, v_uid, 'member')
  on conflict (cave_id, user_id) do nothing;

  get diagnostics v_inserted_count = row_count;

  begin
    insert into public.cave_memberships (user_id, cave_id, cave_name, cave_data, added_by)
    values (
      v_uid,
      p_cave_id,
      v_name,
      jsonb_build_object(
        'id', p_cave_id,
        'name', v_name,
        'emoji', v_emoji,
        'access', 'public',
        'ownerId', v_owner,
        'coverUrl', v_cover
      ),
      v_owner
    )
    on conflict (user_id, cave_id) do update set
      cave_name = excluded.cave_name,
      cave_data = excluded.cave_data,
      created_at = now();
  exception when undefined_table then
    null;
  end;

  update public.caves set updated_at = now() where id = p_cave_id;

  -- Notify owner only on a newly inserted membership row.
  if v_inserted_count > 0 and v_owner is distinct from v_uid then
    begin
      insert into public.notifications (user_id, actor_id, type, cave_id, cave_name)
      values (v_owner, v_uid, 'cave_join', p_cave_id, v_name);
    exception when others then
      null;
    end;
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
        'avatarType', coalesce(pr_m.avatar_type, 'frog'),
        'avatarUrl', pr_m.avatar_url,
        'text', m.body,
        'image', m.image,
        'sticker', m.sticker,
        'pinned', coalesce(m.pinned, false),
        'hidden', coalesce(m.hidden, false),
        'createdAt', m.created_at,
        'reactions', '[]'::jsonb,
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

  return coalesce(v_cave_obj, jsonb_build_object(
    'id', p_cave_id,
    'name', v_name,
    'emoji', v_emoji,
    'ownerId', v_owner,
    'access', 'public',
    'coverUrl', v_cover,
    'members', '[]'::jsonb,
    'messages', '[]'::jsonb
  ));
end;
$$;

revoke all on function public.join_public_cave(text) from public;
revoke all on function public.join_public_cave(text) from anon;
grant execute on function public.join_public_cave(text) to authenticated;

notify pgrst, 'reload schema';
