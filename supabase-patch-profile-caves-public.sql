-- Profile caves: public caves the fren owns and chose to show (not joined caves).
-- Invite-only caves stay off profile lists entirely.
-- Safe to re-run.

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

notify pgrst, 'reload schema';
