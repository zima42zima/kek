-- ⚠️ SUPERSEDED — merged into supabase-caves.sql. See CAVES.md.
--
-- Delete a cave (owner only) and notify all other members.
-- Safe to re-run.

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

  -- Notify every other member before the cave (and memberships) disappear.
  for member_id in
    select cm.user_id
    from public.cave_members cm
    where cm.cave_id = p_cave_id
      and cm.user_id is distinct from uid
  loop
    insert into public.notifications (user_id, actor_id, type, cave_id, cave_name)
    values (member_id, uid, 'cave_deleted', p_cave_id, coalesce(c_name, 'a cave'));
  end loop;

  -- Invite / snapshot table may not FK-cascade from caves.
  delete from public.cave_memberships where cave_id = p_cave_id;

  -- Members, messages, reactions, playlists cascade from caves when FKs exist.
  delete from public.caves where id = p_cave_id;
end;
$$;

grant execute on function public.delete_cave(text) to authenticated;

comment on function public.delete_cave(text) is
  'Owner deletes a cave; former members get a cave_deleted notification.';
