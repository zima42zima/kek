-- Per-cave custom role catalog (max 12). Safe to re-run.

alter table public.caves add column if not exists roles jsonb;

create or replace function public.set_cave_roles(
  p_cave_id text,
  p_roles jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_cave_id is null or length(trim(p_cave_id)) = 0 then
    raise exception 'Cave id required';
  end if;
  if not public.is_cave_keeper(p_cave_id, uid) then
    raise exception 'Only cave keepers can edit roles';
  end if;

  if p_roles is null or jsonb_typeof(p_roles) <> 'array' then
    raise exception 'Roles must be a JSON array';
  end if;

  n := jsonb_array_length(p_roles);
  if n < 1 then raise exception 'At least one role required'; end if;
  if n > 12 then raise exception 'Max 12 roles per cave'; end if;

  update public.caves
  set roles = p_roles,
      updated_at = now()
  where id = p_cave_id;
end;
$$;

grant execute on function public.set_cave_roles(text, jsonb) to authenticated;

-- Include roles on sync payload when owner syncs
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
begin
  if uid is null or cid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.caves (id, owner_id, name, emoji, access, banned, emoji_packs, roles, updated_at)
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

comment on column public.caves.roles is 'Custom role catalog JSON array (max 12).';
