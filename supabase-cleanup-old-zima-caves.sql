-- One-time cleanup: remove orphan caves still listed for Lenchi
--   Ooa · 4224 · the lily pad lounge
--
-- IMPORTANT: Running / pushing the app does NOTHING to these.
-- You must run this in Supabase → SQL Editor (project database).
--
-- Step A: preview (run alone first)
select
  c.id,
  c.name,
  c.owner_id,
  coalesce(pr.silly_name, '(no profile)') as owner_name,
  (select count(*) from public.cave_members cm where cm.cave_id = c.id) as members
from public.caves c
left join public.profiles pr on pr.id = c.owner_id
where lower(trim(c.name)) in (
  'ooa',
  '4224',
  'lily pad lounge',
  'the lily pad lounge'
)
order by c.name;

-- Step B: delete (run after preview looks right)
-- Matches by cave NAME only so owner-name mismatches cannot skip rows.

do $$
declare
  v_ids text[];
begin
  select array_agg(c.id)
    into v_ids
  from public.caves c
  where lower(trim(c.name)) in (
    'ooa',
    '4224',
    'lily pad lounge',
    'the lily pad lounge'
  );

  if v_ids is null or array_length(v_ids, 1) is null then
    raise notice 'No matching caves found — nothing to delete.';
    return;
  end if;

  raise notice 'Deleting cave ids: %', v_ids;

  -- Snapshots / invites
  begin
    delete from public.cave_memberships where cave_id = any (v_ids);
  exception when undefined_table then
    null;
  end;

  -- Explicit child cleanup in case FKs are missing
  begin
    delete from public.cave_message_reactions
    where message_id in (
      select m.id from public.cave_messages m where m.cave_id = any (v_ids)
    );
  exception when undefined_table then
    null;
  end;

  begin
    delete from public.cave_messages where cave_id = any (v_ids);
  exception when undefined_table then
    null;
  end;

  begin
    delete from public.cave_playlist_tracks
    where playlist_id in (
      select p.id from public.cave_playlists p where p.cave_id = any (v_ids)
    );
  exception when undefined_table then
    null;
  end;

  begin
    delete from public.cave_playlists where cave_id = any (v_ids);
  exception when undefined_table then
    null;
  end;

  delete from public.cave_members where cave_id = any (v_ids);
  delete from public.caves where id = any (v_ids);

  raise notice 'Deleted % cave(s).', array_length(v_ids, 1);
end;
$$;

-- Step C: confirm gone (expect 0 rows)
select c.id, c.name
from public.caves c
where lower(trim(c.name)) in (
  'ooa',
  '4224',
  'lily pad lounge',
  'the lily pad lounge'
);
