-- Run this in Supabase → SQL Editor to fix cave invites, kicks, and re-adds.
-- Safe to re-run.

-- 1. sync_cave: reconcile member roster when owner syncs (fixes kick/re-add dead ends)
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
begin
  if uid is null or cid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.caves (id, owner_id, name, emoji, access, banned, emoji_packs, updated_at)
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
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    emoji = excluded.emoji,
    access = case when caves.owner_id = uid then excluded.access else caves.access end,
    banned = case when caves.owner_id = uid then excluded.banned else caves.banned end,
    emoji_packs = case when caves.owner_id = uid then excluded.emoji_packs else caves.emoji_packs end,
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

-- 2. add_cave_member: grant access + notify (never fails on dummy member ids)
create or replace function public.add_cave_member(
  p_target uuid,
  p_cave_id text,
  p_cave_name text,
  p_cave_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mem jsonb;
  mem_id uuid;
  snapshot jsonb := coalesce(p_cave_data, '{}'::jsonb) - 'messages';
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_target is null or p_target = uid then return; end if;

  perform public.sync_cave(p_cave_data);

  if not exists (
    select 1 from public.caves c where c.id = p_cave_id and c.owner_id = uid
  ) then
    raise exception 'Only the cave owner can add members';
  end if;

  update public.caves
  set banned = array_remove(coalesce(banned, '{}'::uuid[]), p_target)
  where id = p_cave_id;

  insert into public.cave_members (cave_id, user_id, role)
  values (p_cave_id, p_target, 'member')
  on conflict (cave_id, user_id) do update set role = 'member';

  for mem in select value from jsonb_array_elements(coalesce(p_cave_data->'members', '[]'::jsonb))
  loop
    begin
      mem_id := (mem->>'id')::uuid;
      insert into public.cave_members (cave_id, user_id, role)
      values (p_cave_id, mem_id, coalesce(mem->>'role', 'member'))
      on conflict (cave_id, user_id) do nothing;
    exception when others then
      continue;
    end;
  end loop;

  insert into public.cave_memberships (user_id, cave_id, cave_name, cave_data, added_by)
  values (p_target, p_cave_id, p_cave_name, snapshot, uid)
  on conflict (user_id, cave_id) do update set
    cave_name = excluded.cave_name,
    cave_data = excluded.cave_data,
    added_by = excluded.added_by,
    created_at = now();

  insert into public.notifications (user_id, actor_id, type, cave_id, cave_name)
  values (p_target, uid, 'cave_add', p_cave_id, p_cave_name);
end;
$$;

-- 3. remove_cave_member: kick/ban clears server access so re-add works
create or replace function public.remove_cave_member(
  p_cave_id text,
  p_target uuid,
  p_ban boolean default false
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
  if p_target is null or p_target = uid then return; end if;

  if not exists (
    select 1 from public.caves c where c.id = p_cave_id and c.owner_id = uid
  ) then
    raise exception 'Only the cave owner can remove members';
  end if;

  delete from public.cave_memberships where cave_id = p_cave_id and user_id = p_target;
  delete from public.cave_members where cave_id = p_cave_id and user_id = p_target;

  if p_ban then
    update public.caves
    set banned = (
      select coalesce(array_agg(distinct x), '{}'::uuid[])
      from (
        select unnest(coalesce(banned, '{}'::uuid[])) as x
        union
        select p_target
      ) s
    )
    where id = p_cave_id;
  end if;
end;
$$;

grant execute on function public.sync_cave(jsonb) to authenticated;
grant execute on function public.add_cave_member(uuid, text, text, jsonb) to authenticated;
grant execute on function public.remove_cave_member(text, uuid, boolean) to authenticated;
