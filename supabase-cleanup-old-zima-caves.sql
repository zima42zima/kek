-- DELETE these three caves for good. Run ALL of this in Supabase → SQL Editor.
-- Pushing the app does nothing. Cache clear alone also does nothing if sync reloads them.

-- Preview
select id, name, owner_id from public.caves
where lower(trim(name)) in ('ooa', '4224', 'lily pad lounge', 'the lily pad lounge');

-- Force delete (name match only)
delete from public.cave_memberships
where cave_id in (
  select id from public.caves
  where lower(trim(name)) in ('ooa', '4224', 'lily pad lounge', 'the lily pad lounge')
);

delete from public.cave_members
where cave_id in (
  select id from public.caves
  where lower(trim(name)) in ('ooa', '4224', 'lily pad lounge', 'the lily pad lounge')
);

delete from public.cave_messages
where cave_id in (
  select id from public.caves
  where lower(trim(name)) in ('ooa', '4224', 'lily pad lounge', 'the lily pad lounge')
);

delete from public.caves
where lower(trim(name)) in ('ooa', '4224', 'lily pad lounge', 'the lily pad lounge');

-- Must be 0 rows
select id, name from public.caves
where lower(trim(name)) in ('ooa', '4224', 'lily pad lounge', 'the lily pad lounge');
