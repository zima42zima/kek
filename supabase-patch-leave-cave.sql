-- ⚠️ SUPERSEDED — merged into supabase-caves.sql. See CAVES.md.
--
-- Allow a member to leave a cave (not the owner).
-- Safe to re-run. No tables created.

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
    -- Cave already gone — still clear any leftover membership snapshot.
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

notify pgrst, 'reload schema';
