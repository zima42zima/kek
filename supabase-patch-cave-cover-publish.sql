-- Harden cave cover publish for all members.
-- Safe to re-run. No tables created. Owner (or keeper) can set cover_url.
-- Run in Supabase → SQL Editor if covers only show for the cave owner.

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
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_allowed boolean := false;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_cave_id is null or length(trim(p_cave_id)) = 0 then
    raise exception 'Cave id required';
  end if;

  select c.owner_id into v_owner
  from public.caves c
  where c.id = p_cave_id;

  if v_owner is null then
    raise exception 'Cave not found';
  end if;

  -- Owner always allowed. Keepers allowed when mod_role column exists.
  v_allowed := (v_owner = v_uid);
  if not v_allowed then
    begin
      select exists (
        select 1 from public.cave_members cm
        where cm.cave_id = p_cave_id
          and cm.user_id = v_uid
          and cm.mod_role in ('keeper', 'co_keeper')
      ) into v_allowed;
    exception when undefined_column then
      v_allowed := false;
    end;
  end if;

  if not v_allowed then
    raise exception 'Only the cave owner or a keeper can set cover';
  end if;

  update public.caves
  set cover_url = nullif(trim(p_cover_url), ''),
      updated_at = now()
  where id = p_cave_id;
end;
$$;

revoke all on function public.set_cave_cover(text, text) from public;
revoke all on function public.set_cave_cover(text, text) from anon;
grant execute on function public.set_cave_cover(text, text) to authenticated;

notify pgrst, 'reload schema';
