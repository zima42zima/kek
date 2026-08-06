-- One-time cleanup: remove old zima caves that still show for Lenchi
-- (Ooa, lily pad lounge, 4224) but no longer appear on zima's account.
--
-- Safe pattern: preview first, then delete.
-- Run in Supabase → SQL Editor as the project owner (service role / postgres).

-- 1) Preview what will be removed
select
  c.id,
  c.name,
  c.access,
  c.owner_id,
  coalesce(pr.silly_name, '(no profile)') as owner_name,
  (select count(*) from public.cave_members cm where cm.cave_id = c.id) as members
from public.caves c
left join public.profiles pr on pr.id = c.owner_id
where
  lower(trim(c.name)) in (
    'ooa',
    '4224',
    'lily pad lounge',
    'the lily pad lounge'
  )
  and (
    lower(coalesce(pr.silly_name, '')) = 'zima'
    or c.owner_id in (
      select p.id from public.profiles p where lower(p.silly_name) = 'zima'
    )
  )
order by c.name;

-- 2) Delete those caves (and leftover membership snapshots).
-- Members / messages usually cascade from caves; memberships table is cleaned explicitly.
with doomed as (
  select c.id
  from public.caves c
  left join public.profiles pr on pr.id = c.owner_id
  where
    lower(trim(c.name)) in (
      'ooa',
      '4224',
      'lily pad lounge',
      'the lily pad lounge'
    )
    and (
      lower(coalesce(pr.silly_name, '')) = 'zima'
      or c.owner_id in (
        select p.id from public.profiles p where lower(p.silly_name) = 'zima'
      )
    )
)
delete from public.cave_memberships m
using doomed d
where m.cave_id = d.id;

with doomed as (
  select c.id
  from public.caves c
  left join public.profiles pr on pr.id = c.owner_id
  where
    lower(trim(c.name)) in (
      'ooa',
      '4224',
      'lily pad lounge',
      'the lily pad lounge'
    )
    and (
      lower(coalesce(pr.silly_name, '')) = 'zima'
      or c.owner_id in (
        select p.id from public.profiles p where lower(p.silly_name) = 'zima'
      )
    )
)
delete from public.caves c
using doomed d
where c.id = d.id;

-- 3) Confirm they're gone
select c.id, c.name
from public.caves c
left join public.profiles pr on pr.id = c.owner_id
where
  lower(trim(c.name)) in (
    'ooa',
    '4224',
    'lily pad lounge',
    'the lily pad lounge'
  )
  and lower(coalesce(pr.silly_name, '')) = 'zima';
-- Expect 0 rows.
