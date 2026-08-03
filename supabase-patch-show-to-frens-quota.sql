-- Private daily show-to-frens quota (for "N left today" hint). Safe to re-run.
-- Run after supabase-patch-show-to-frens.sql.

create or replace function public.get_show_to_frens_quota()
returns table (
  used_today int,
  daily_limit int,
  remaining int
)
language sql
security definer
set search_path = public
stable
as $$
  with usage as (
    select count(*)::int as used_today
    from public.post_shows s
    where s.user_id = auth.uid()
      and s.created_at > now() - interval '1 day'
  )
  select
    u.used_today,
    10 as daily_limit,
    greatest(0, 10 - u.used_today) as remaining
  from usage u;
$$;

grant execute on function public.get_show_to_frens_quota() to authenticated;
