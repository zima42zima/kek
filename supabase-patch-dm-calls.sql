-- DM call signaling (reliable DB polling — works without Realtime broadcast).
-- Safe to re-run. Run after supabase-patch-dms.sql.

create table if not exists public.dm_call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id text not null,
  to_user uuid references auth.users on delete cascade not null,
  from_user uuid references auth.users on delete cascade not null,
  signal_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz default now()
);

create index if not exists dm_call_signals_to_created_idx
  on public.dm_call_signals (to_user, created_at);

grant all on public.dm_call_signals to postgres, service_role;
grant select, insert on public.dm_call_signals to authenticated;

alter table public.dm_call_signals enable row level security;

drop policy if exists "Users send call signals" on public.dm_call_signals;
create policy "Users send call signals"
  on public.dm_call_signals for insert to authenticated
  with check (from_user = auth.uid());

drop policy if exists "Users read incoming call signals" on public.dm_call_signals;
create policy "Users read incoming call signals"
  on public.dm_call_signals for select to authenticated
  using (to_user = auth.uid());

create or replace function public.send_dm_call_signal(
  p_to uuid,
  p_call_id text,
  p_signal_type text,
  p_payload jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_to is null or p_to = uid then raise exception 'Invalid call recipient'; end if;
  insert into public.dm_call_signals (call_id, to_user, from_user, signal_type, payload)
  values (
    p_call_id,
    p_to,
    uid,
    p_signal_type,
    coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

create or replace function public.poll_dm_call_signals(
  p_since timestamptz default (now() - interval '10 minutes')
)
returns table (
  id uuid,
  call_id text,
  from_user uuid,
  signal_type text,
  payload jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.call_id, s.from_user, s.signal_type, s.payload, s.created_at
  from public.dm_call_signals s
  where s.to_user = auth.uid()
    and s.created_at > p_since
  order by s.created_at asc
  limit 200;
$$;

grant execute on function public.send_dm_call_signal(uuid, text, text, jsonb) to authenticated;
grant execute on function public.poll_dm_call_signals(timestamptz) to authenticated;

notify pgrst, 'reload schema';
