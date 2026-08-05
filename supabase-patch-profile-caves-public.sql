-- Profile caves: owned public caves that the fren chose to show.
-- Also adds set_cave_access so "Make public" always persists even when sync_cave is outdated.
-- Safe to re-run.

alter table public.caves add column if not exists cover_url text;

-- ---------------------------------------------------------------------------
-- Dedicated access toggle (owner only). Does not depend on sync_cave / roles.
-- ---------------------------------------------------------------------------
create or replace function public.set_cave_access(
  p_cave_id text,
  p_access text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  next_access text := lower(trim(coalesce(p_access, 'invite')));
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_cave_id is null or length(trim(p_cave_id)) = 0 then
    raise exception 'Cave id required';
  end if;
  if next_access not in ('public', 'invite') then
    raise exception 'access must be public or invite';
  end if;

  if not exists (
    select 1 from public.caves c
    where c.id = p_cave_id and c.owner_id = uid
  ) then
    raise exception 'Only the cave owner can change access';
  end if;

  update public.caves
  set access = next_access, updated_at = now()
  where id = p_cave_id and owner_id = uid;

  insert into public.cave_members (cave_id, user_id, role, hidden_on_profile)
  values (
    p_cave_id,
    uid,
    'owner',
    case when next_access = 'invite' then true else false end
  )
  on conflict (cave_id, user_id) do update
    set role = 'owner',
        hidden_on_profile = case
          when next_access = 'invite' then true
          else coalesce(cave_members.hidden_on_profile, false)
        end;
end;
$$;

grant execute on function public.set_cave_access(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Profile list: public caves this fren owns and did not hide.
-- ---------------------------------------------------------------------------
drop function if exists public.list_profile_caves(uuid);

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
    true as is_owner,
    c.cover_url
  from public.caves c
  left join public.cave_members cm
    on cm.cave_id = c.id and cm.user_id = p_user
  where c.owner_id = p_user
    and c.access = 'public'
    and coalesce(cm.hidden_on_profile, false) = false
  order by c.updated_at desc nulls last;
$$;

grant execute on function public.list_profile_caves(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Profile hide toggle: upsert owner membership row.
-- ---------------------------------------------------------------------------
create or replace function public.set_cave_profile_hidden(p_cave_id text, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  insert into public.cave_members (cave_id, user_id, role, hidden_on_profile)
  select p_cave_id, uid, 'owner', coalesce(p_hidden, false)
  from public.caves c
  where c.id = p_cave_id and c.owner_id = uid
  on conflict (cave_id, user_id) do update
    set hidden_on_profile = coalesce(p_hidden, false);

  update public.cave_members
  set hidden_on_profile = coalesce(p_hidden, false)
  where cave_id = p_cave_id and user_id = uid;
end;
$$;

grant execute on function public.set_cave_profile_hidden(text, boolean) to authenticated;

notify pgrst, 'reload schema';
