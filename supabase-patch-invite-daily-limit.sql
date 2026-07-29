-- MISAO — 3 invite codes per fren per rolling 24 hours
-- Run in Supabase SQL Editor. Safe to re-run.

create or replace function public.get_invite_daily_quota()
returns table (
  daily_limit int,
  created_last_24h int,
  remaining int,
  resets_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
  lim int := 3;
  cnt int;
  oldest timestamptz;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select count(*)::int into cnt
  from public.invites
  where created_by = uid
    and created_at > now() - interval '24 hours';

  cnt := coalesce(cnt, 0);

  if cnt >= lim then
    select min(i.created_at) into oldest
    from (
      select created_at
      from public.invites
      where created_by = uid
        and created_at > now() - interval '24 hours'
      order by created_at asc
      limit lim
    ) i;

    return query select
      lim,
      cnt,
      0,
      oldest + interval '24 hours';
    return;
  end if;

  return query select
    lim,
    cnt,
    lim - cnt,
    null::timestamptz;
end;
$$;

create or replace function public.create_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_code text;
  unused int;
  recent int;
  tries int := 0;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select count(*)::int into recent
  from public.invites
  where created_by = uid
    and created_at > now() - interval '24 hours';

  if recent >= 3 then
    raise exception 'Daily invite limit reached (3 per 24 hours). Try again later.';
  end if;

  select count(*)::int into unused
  from public.invites
  where created_by = uid and used_by is null;

  if unused >= 10 then
    raise exception 'You have 10 unused invite codes already. Share one first.';
  end if;

  loop
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.invites i where i.code = new_code);
    tries := tries + 1;
    if tries > 25 then
      raise exception 'Could not generate invite code';
    end if;
  end loop;

  insert into public.invites (code, created_by)
  values (new_code, uid);

  return new_code;
end;
$$;

grant execute on function public.get_invite_daily_quota() to authenticated;

notify pgrst, 'reload schema';
