-- get_cave: any member can load one full cave (members, messages, cover).
-- Also keeps sync_cave from deleting joiners. Safe to re-run.
-- Does NOT create tables. Variables use v_ prefixes (avoid Supabase RLS false positives).

-- ---------------------------------------------------------------------------
-- sync_cave: upsert only — never delete members missing from client roster
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
-- get_cave: full snapshot for a cave the caller belongs to
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

  return coalesce(v_cave_obj, 'null'::jsonb);
end;
$$;

revoke all on function public.get_cave(text) from public;
revoke all on function public.get_cave(text) from anon;
grant execute on function public.get_cave(text) to authenticated;

notify pgrst, 'reload schema';
