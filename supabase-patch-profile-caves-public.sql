-- Profile caves: only public caves may appear on a fren's profile.
-- Invite-only / close-circle caves stay off profile lists entirely.
-- Safe to re-run.

drop function if exists public.list_profile_caves(uuid);

create or replace function public.list_profile_caves(p_user uuid)
returns table (
  cave_id text,
  name text,
  emoji text,
  access text,
  is_owner boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.emoji, c.access, (c.owner_id = p_user) as is_owner
  from public.cave_members cm
  join public.caves c on c.id = cm.cave_id
  where cm.user_id = p_user
    and coalesce(cm.hidden_on_profile, false) = false
    and c.access = 'public'
  order by c.updated_at desc;
$$;

grant execute on function public.list_profile_caves(uuid) to authenticated;

notify pgrst, 'reload schema';
