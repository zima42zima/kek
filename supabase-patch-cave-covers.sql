-- Cave cover photos for list/detail preview.
-- Safe to re-run. Run in Supabase → SQL Editor.

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
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_cave_id is null or length(trim(p_cave_id)) = 0 then
    raise exception 'Cave id required';
  end if;
  if not public.is_cave_keeper(p_cave_id, uid) then
    raise exception 'Only cave keepers can set cover';
  end if;

  update public.caves
  set cover_url = nullif(trim(p_cover_url), ''),
      updated_at = now()
  where id = p_cave_id;
end;
$$;

grant execute on function public.set_cave_cover(text, text) to authenticated;

-- Discover list includes cover when present
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
    ) as i_member,
    c.cover_url
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

-- Profile public caves include cover_url when column exists (best-effort reshape)
create or replace function public.list_profile_caves(p_user uuid)
returns table (
  cave_id text,
  name text,
  emoji text,
  access text,
  is_owner boolean,
  cover_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id as cave_id,
    c.name,
    coalesce(c.emoji, '🕳️') as emoji,
    c.access,
    (c.owner_id = p_user) as is_owner,
    c.cover_url
  from public.caves c
  join public.cave_members cm on cm.cave_id = c.id and cm.user_id = p_user
  where c.access = 'public'
    and not coalesce(c.hidden_on_profile, false)
    and not coalesce(cm.hidden_on_profile, false)
  order by c.updated_at desc nulls last;
$$;

grant execute on function public.list_profile_caves(uuid) to authenticated;

comment on column public.caves.cover_url is 'Optional cover image URL for cave list/detail preview.';
