-- Public cave discover/search + self-join.
-- Safe to re-run. Run in Supabase → SQL Editor after cave patches.

-- Search public caves by name (empty query = recent public list).
create or replace function public.search_public_caves(p_query text default null)
returns table (
  cave_id text,
  name text,
  emoji text,
  owner_id uuid,
  member_count bigint,
  i_member boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
  needle text := nullif(trim(coalesce(p_query, '')), '');
begin
  if uid is null then
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
      where m.cave_id = c.id and m.user_id = uid
    ) as i_member
  from public.caves c
  where c.access = 'public'
    and not (uid = any (coalesce(c.banned, '{}'::uuid[])))
    and (
      needle is null
      or c.name ilike '%' || needle || '%'
    )
  order by c.updated_at desc nulls last, c.created_at desc nulls last
  limit 40;
end;
$$;

grant execute on function public.search_public_caves(text) to authenticated;

-- Join a public cave as yourself (if not banned).
create or replace function public.join_public_cave(p_cave_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c_access text;
  c_owner uuid;
  c_banned uuid[];
  c_name text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_cave_id is null or length(trim(p_cave_id)) = 0 then
    raise exception 'Cave id required';
  end if;

  select c.access, c.owner_id, coalesce(c.banned, '{}'::uuid[]), c.name
    into c_access, c_owner, c_banned, c_name
  from public.caves c
  where c.id = p_cave_id;

  if c_owner is null then
    raise exception 'Cave not found';
  end if;
  if c_access is distinct from 'public' then
    raise exception 'This cave is not public';
  end if;
  if uid = any (c_banned) then
    raise exception 'You cannot join this cave';
  end if;

  insert into public.cave_members (cave_id, user_id, role)
  values (p_cave_id, uid, 'member')
  on conflict (cave_id, user_id) do nothing;

  -- Snapshot for memberships list (if table exists)
  begin
    insert into public.cave_memberships (user_id, cave_id, cave_name, cave_data, added_by)
    values (
      uid,
      p_cave_id,
      c_name,
      jsonb_build_object('id', p_cave_id, 'name', c_name, 'access', 'public', 'ownerId', c_owner),
      c_owner
    )
    on conflict (user_id, cave_id) do update set
      cave_name = excluded.cave_name,
      created_at = now();
  exception when undefined_table then
    null;
  end;
end;
$$;

grant execute on function public.join_public_cave(text) to authenticated;

notify pgrst, 'reload schema';
