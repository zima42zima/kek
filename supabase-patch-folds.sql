-- FOLDS peer send + inbox (and optional publish later).
-- Safe to re-run. Run in Supabase → SQL Editor.

create table if not exists public.fold_deliveries (
  id uuid primary key default gen_random_uuid(),
  from_user uuid references auth.users on delete set null,
  to_user uuid references auth.users on delete cascade not null,
  fold_id text,
  title text,
  format_id text,
  payload jsonb not null default '{}'::jsonb,
  note text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists fold_deliveries_to_idx
  on public.fold_deliveries (to_user, created_at desc);

create index if not exists fold_deliveries_from_idx
  on public.fold_deliveries (from_user, created_at desc);

grant select, insert, update, delete on public.fold_deliveries to authenticated;

alter table public.fold_deliveries enable row level security;

drop policy if exists "Recipients and senders read fold deliveries" on public.fold_deliveries;
create policy "Recipients and senders read fold deliveries"
  on public.fold_deliveries for select to authenticated
  using (to_user = auth.uid() or from_user = auth.uid());

drop policy if exists "Users send folds" on public.fold_deliveries;
create policy "Users send folds"
  on public.fold_deliveries for insert to authenticated
  with check (from_user = auth.uid());

drop policy if exists "Recipients update fold deliveries" on public.fold_deliveries;
create policy "Recipients update fold deliveries"
  on public.fold_deliveries for update to authenticated
  using (to_user = auth.uid());

drop policy if exists "Recipients delete fold deliveries" on public.fold_deliveries;
create policy "Recipients delete fold deliveries"
  on public.fold_deliveries for delete to authenticated
  using (to_user = auth.uid());

-- Optional link on notifications
alter table public.notifications
  add column if not exists fold_delivery_id uuid references public.fold_deliveries(id) on delete cascade;

create or replace function public.send_fold(
  p_to uuid,
  p_title text,
  p_format_id text,
  p_payload jsonb,
  p_note text default null,
  p_fold_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  clean_title text := nullif(trim(coalesce(p_title, '')), '');
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_to is null then raise exception 'Recipient required'; end if;
  if p_to = uid then raise exception 'Cannot send a fold to yourself'; end if;
  if p_payload is null or p_payload = '{}'::jsonb then
    raise exception 'Fold payload required';
  end if;

  insert into public.fold_deliveries (
    from_user, to_user, fold_id, title, format_id, payload, note
  )
  values (
    uid,
    p_to,
    nullif(trim(coalesce(p_fold_id, '')), ''),
    coalesce(clean_title, 'Untitled fold'),
    coalesce(nullif(trim(coalesce(p_format_id, '')), ''), 'print'),
    p_payload,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into new_id;

  begin
    insert into public.notifications (user_id, actor_id, type, fold_delivery_id)
    values (p_to, uid, 'fold_received', new_id);
  exception when others then
    -- notifications table / column may lag; delivery still succeeds
    null;
  end;

  return new_id;
end;
$$;

grant execute on function public.send_fold(uuid, text, text, jsonb, text, text) to authenticated;

create or replace function public.list_fold_inbox()
returns table (
  id uuid,
  from_user uuid,
  from_name text,
  fold_id text,
  title text,
  format_id text,
  payload jsonb,
  note text,
  read boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    d.id,
    d.from_user,
    coalesce(pr.silly_name, 'a fren') as from_name,
    d.fold_id,
    d.title,
    d.format_id,
    d.payload,
    d.note,
    d.read,
    d.created_at
  from public.fold_deliveries d
  left join public.profiles pr on pr.id = d.from_user
  where d.to_user = auth.uid()
  order by d.created_at desc
  limit 60;
$$;

grant execute on function public.list_fold_inbox() to authenticated;

create or replace function public.mark_fold_delivery_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.fold_deliveries
  set read = true
  where id = p_id and to_user = auth.uid();
end;
$$;

grant execute on function public.mark_fold_delivery_read(uuid) to authenticated;

notify pgrst, 'reload schema';
