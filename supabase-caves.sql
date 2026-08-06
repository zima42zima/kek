-- =============================================================================
-- MISAO — CANONICAL CAVES FOUNDATION
-- =============================================================================
-- Safe to re-run. Source of truth for core cave RPCs (see CAVES.md).
--
-- Requires: supabase-fix-profile-permissions.sql (base tables).
-- After any older cave patch, run THIS file last so sync_cave stays upsert-only.
--
-- Scale notes:
--   • sync_cave never deletes joiners from a client roster
--   • list/get payloads cap messages (80 / 200 / 500)
--   • indexes for member lookup + message timelines
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A. Schema (idempotent)
-- ---------------------------------------------------------------------------
alter table public.caves add column if not exists cover_url text;
alter table public.caves add column if not exists roles jsonb;
alter table public.caves add column if not exists access text default 'invite';
alter table public.caves add column if not exists banned uuid[] default '{}';
alter table public.caves add column if not exists emoji_packs jsonb default '[]';
alter table public.caves add column if not exists updated_at timestamptz default now();

alter table public.cave_members add column if not exists hidden_on_profile boolean default false;
alter table public.cave_members add column if not exists fun_title text default 'dweller';
alter table public.cave_members add column if not exists title_expires_at timestamptz;
alter table public.cave_members add column if not exists mod_role text;
alter table public.cave_members add column if not exists mod_expires_at timestamptz;
alter table public.cave_members add column if not exists role text default 'member';
alter table public.cave_members add column if not exists joined_at timestamptz default now();

alter table public.cave_messages
  add column if not exists parent_id bigint references public.cave_messages(id) on delete set null;
alter table public.cave_messages add column if not exists pinned boolean default false;
alter table public.cave_messages add column if not exists hidden boolean default false;

create index if not exists cave_members_user_idx on public.cave_members (user_id);
create index if not exists cave_members_cave_joined_idx on public.cave_members (cave_id, joined_at);
create index if not exists cave_messages_cave_idx on public.cave_messages (cave_id, created_at);
create index if not exists cave_messages_parent_idx
  on public.cave_messages (cave_id, parent_id)
  where parent_id is not null;
create index if not exists caves_owner_idx on public.caves (owner_id);
create index if not exists caves_public_updated_idx
  on public.caves (updated_at desc nulls last)
  where access = 'public';

-- Minimal keeper check (richer version may come from cave-roles.sql).
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

revoke all on function public.is_cave_keeper(text, uuid) from public;
revoke all on function public.is_cave_keeper(text, uuid) from anon;
grant execute on function public.is_cave_keeper(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- B. sync_cave — UPSERT ONLY (never delete joiners from client roster)
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
-- C. Discover + join
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
-- D. leave + delete
-- ---------------------------------------------------------------------------
create or replace function public.leave_cave(p_cave_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_cave_id is null or length(trim(p_cave_id)) = 0 then
    raise exception 'Cave id required';
  end if;

  select c.owner_id into v_owner
    from public.caves c
   where c.id = p_cave_id;

  if v_owner is null then
    begin
      delete from public.cave_memberships
      where cave_id = p_cave_id and user_id = v_uid;
    exception when undefined_table then
      null;
    end;
    delete from public.cave_members
    where cave_id = p_cave_id and user_id = v_uid;
    return;
  end if;

  if v_owner = v_uid then
    raise exception 'Owners cannot leave — delete the cave instead';
  end if;

  begin
    delete from public.cave_memberships
    where cave_id = p_cave_id and user_id = v_uid;
  exception when undefined_table then
    null;
  end;

  delete from public.cave_members
  where cave_id = p_cave_id and user_id = v_uid;
end;
$$;

revoke all on function public.leave_cave(text) from public;
revoke all on function public.leave_cave(text) from anon;
grant execute on function public.leave_cave(text) to authenticated;

create or replace function public.delete_cave(p_cave_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c_owner uuid;
  c_name text;
  member_id uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_cave_id is null or length(trim(p_cave_id)) = 0 then
    raise exception 'Cave id required';
  end if;

  select c.owner_id, c.name
    into c_owner, c_name
  from public.caves c
  where c.id = p_cave_id;

  if c_owner is null then
    raise exception 'Cave not found';
  end if;

  if c_owner <> uid then
    raise exception 'Only the cave owner can delete this cave';
  end if;

  for member_id in
    select cm.user_id
    from public.cave_members cm
    where cm.cave_id = p_cave_id
      and cm.user_id is distinct from uid
  loop
    insert into public.notifications (user_id, actor_id, type, cave_id, cave_name)
    values (member_id, uid, 'cave_deleted', p_cave_id, coalesce(c_name, 'a cave'));
  end loop;

  begin
    delete from public.cave_memberships where cave_id = p_cave_id;
  exception when undefined_table then
    null;
  end;

  delete from public.caves where id = p_cave_id;
end;
$$;

revoke all on function public.delete_cave(text) from public;
revoke all on function public.delete_cave(text) from anon;
grant execute on function public.delete_cave(text) to authenticated;

-- ---------------------------------------------------------------------------
-- E. Read paths — avatar coalesce + message caps
-- ---------------------------------------------------------------------------
create or replace function public.cave_message_ts(p_created timestamptz)
returns text
language sql
stable
as $$
  select case
    when p_created > now() - interval '45 seconds' then 'just now'
    when p_created > now() - interval '1 hour' then floor(extract(epoch from (now() - p_created)) / 60)::text || 'm'
    when p_created > now() - interval '1 day' then floor(extract(epoch from (now() - p_created)) / 3600)::text || 'h'
    else to_char(p_created, 'Mon DD')
  end;
$$;

-- Stub only if reactions patch not installed yet (real impl replaces this).
do $$
begin
  if to_regprocedure('public.cave_message_reactions_json(bigint)') is null then
    execute $f$
      create function public.cave_message_reactions_json(p_message_id bigint)
      returns jsonb
      language sql
      stable
      as $body$ select '[]'::jsonb $body$;
    $f$;
  end if;
end $$;

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
  select * from (
    select
      m.id,
      m.author_id,
      coalesce(pr.silly_name, m.author_name, 'a fren') as author_name,
      coalesce(nullif(pr.avatar_type, ''), nullif(m.avatar_type, ''), 'frog') as avatar_type,
      coalesce(nullif(pr.avatar_url, ''), nullif(m.avatar_url, '')) as avatar_url,
      m.body, m.image, m.sticker, m.created_at,
      coalesce(m.pinned, false) as pinned,
      coalesce(m.hidden, false) as hidden,
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
    order by m.created_at desc
    limit 500
  ) recent
  order by created_at asc;
$$;

revoke all on function public.list_cave_messages(text) from public;
revoke all on function public.list_cave_messages(text) from anon;
grant execute on function public.list_cave_messages(text) to authenticated;

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
    'memberCount', (select count(*)::int from public.cave_members cmx where cmx.cave_id = c.id),
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
      select jsonb_agg(x.obj order by x.created_at)
      from (
        select jsonb_build_object(
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
          'ts', public.cave_message_ts(m.created_at)
        ) as obj,
        m.created_at
        from public.cave_messages m
        left join public.profiles pr_m on pr_m.id = m.author_id
        where m.cave_id = c.id
          and (v_keeper or not coalesce(m.hidden, false))
        order by m.created_at desc
        limit 200
      ) x
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

-- Re-bind join_public_cave now that get_cave exists.
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

  if v_inserted_count > 0 and v_owner is distinct from v_uid then
    begin
      insert into public.notifications (user_id, actor_id, type, cave_id, cave_name)
      values (v_owner, v_uid, 'cave_join', p_cave_id, v_name);
    exception when others then
      null;
    end;
  end if;

  return public.get_cave(p_cave_id);
end;
$$;

revoke all on function public.join_public_cave(text) from public;
revoke all on function public.join_public_cave(text) from anon;
grant execute on function public.join_public_cave(text) to authenticated;

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
      'banned', to_jsonb(coalesce(c.banned, '{}'::uuid[])),
      'emojiPacks', coalesce(c.emoji_packs, '[]'::jsonb),
      'hiddenOnProfile', coalesce(my.hidden_on_profile, false),
      'memberCount', (select count(*)::int from public.cave_members cmx where cmx.cave_id = c.id),
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
        select jsonb_agg(x.obj order by x.created_at)
        from (
          select jsonb_build_object(
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
            'ts', public.cave_message_ts(m.created_at)
          ) as obj,
          m.created_at
          from public.cave_messages m
          left join public.profiles pr_m on pr_m.id = m.author_id
          where m.cave_id = c.id
            and (keeper or not coalesce(m.hidden, false))
          order by m.created_at desc
          limit 80
        ) x
      ), '[]'::jsonb)
    ) into cave_obj
    from public.caves c
    join public.cave_members my on my.cave_id = c.id and my.user_id = uid
    where c.id = cid;

    if cave_obj is not null then
      result := result || jsonb_build_array(cave_obj);
    end if;
  end loop;

  return result;
end;
$$;

revoke all on function public.list_my_caves() from public;
revoke all on function public.list_my_caves() from anon;
grant execute on function public.list_my_caves() to authenticated;

notify pgrst, 'reload schema';
