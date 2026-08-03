-- Platform moderation — founder / co-founder staff, unified reports, suspend users.
-- Safe to re-run. Run after supabase-patch-rabbit-hole-v2.sql and profile patches.

-- ── Staff roles & suspension ────────────────────────────────────────────────

alter table public.profiles add column if not exists is_cofounder boolean default false;
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles add column if not exists suspended_reason text;
alter table public.profiles add column if not exists suspended_by uuid references auth.users on delete set null;

create or replace function public.am_i_platform_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select (p.is_founder or p.is_cofounder)
      from public.profiles p
      where p.id = auth.uid()
        and p.suspended_at is null
    ),
    false
  );
$$;

create or replace function public.am_i_rabbit_mod()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.am_i_platform_staff();
$$;

create or replace function public.assert_active_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.suspended_at is not null
  ) then
    raise exception 'Account suspended';
  end if;
end;
$$;

-- Lock founder flags — only bootstrap signup or SQL may set them.
create or replace function public.upsert_my_profile(
  p_silly_name text default null,
  p_one_human_thing text default null,
  p_bio text default null,
  p_avatar_url text default null,
  p_avatar_type text default null,
  p_share_location boolean default null,
  p_is_founder boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gate_open boolean;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select public.signup_gate_open() into gate_open;

  insert into public.profiles as p (
    id, silly_name, one_human_thing, bio, avatar_url, avatar_type, share_location, is_founder
  )
  values (
    uid,
    coalesce(nullif(trim(p_silly_name), ''), 'nameless fren'),
    p_one_human_thing,
    p_bio,
    p_avatar_url,
    coalesce(p_avatar_type, 'frog'),
    coalesce(p_share_location, false),
    case when gate_open and coalesce(p_is_founder, false) then true else false end
  )
  on conflict (id) do update set
    silly_name = coalesce(nullif(trim(p_silly_name), ''), p.silly_name),
    one_human_thing = coalesce(p_one_human_thing, p.one_human_thing),
    bio = coalesce(p_bio, p.bio),
    avatar_url = coalesce(p_avatar_url, p.avatar_url),
    avatar_type = coalesce(p_avatar_type, p.avatar_type),
    share_location = coalesce(p_share_location, p.share_location);
    -- is_founder / is_cofounder never change from client upsert
end;
$$;

-- ── Unified report inbox ────────────────────────────────────────────────────

create table if not exists public.platform_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users on delete cascade not null,
  reported_user_id uuid references auth.users on delete set null,
  kind text not null,
  ref_id text not null,
  preview text,
  reason text,
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  resolved_at timestamptz,
  resolved_by uuid references auth.users on delete set null,
  resolution_note text,
  created_at timestamptz default now()
);

create index if not exists platform_reports_status_idx
  on public.platform_reports (status, created_at desc);

alter table public.platform_reports enable row level security;

drop policy if exists "Staff read platform reports" on public.platform_reports;
create policy "Staff read platform reports"
  on public.platform_reports for select to authenticated
  using (public.am_i_platform_staff());

grant select on public.platform_reports to authenticated;
grant insert on public.platform_reports to authenticated;

alter table public.notifications add column if not exists platform_report_id uuid
  references public.platform_reports on delete cascade;

create or replace function public.tg_notify_staff_platform_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  staff record;
  preview text := coalesce(new.preview, 'New report');
begin
  for staff in
    select p.id as user_id
    from public.profiles p
    where (p.is_founder or p.is_cofounder)
      and p.suspended_at is null
  loop
    insert into public.notifications (user_id, actor_id, type, platform_report_id, rabbit_preview)
    values (staff.user_id, new.reporter_id, 'platform_report', new.id, left(preview, 120));
  end loop;
  return new;
end;
$$;

drop trigger if exists on_platform_report_notify on public.platform_reports;
create trigger on_platform_report_notify
  after insert on public.platform_reports
  for each row
  when (new.status = 'open')
  execute function public.tg_notify_staff_platform_report();

create or replace function public._insert_platform_report(
  p_kind text,
  p_ref_id text,
  p_reported_user uuid default null,
  p_preview text default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
begin
  perform public.assert_active_user();
  insert into public.platform_reports (
    reporter_id, reported_user_id, kind, ref_id, preview, reason
  )
  values (
    uid,
    p_reported_user,
    p_kind,
    p_ref_id,
    nullif(trim(p_preview), ''),
    nullif(trim(p_reason), '')
  )
  returning id into rid;
  return rid;
end;
$$;

create or replace function public.file_platform_report(
  p_kind text,
  p_ref_id text,
  p_reported_user uuid default null,
  p_preview text default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public._insert_platform_report(
    p_kind, p_ref_id, p_reported_user, p_preview, p_reason
  );
end;
$$;

create or replace function public.report_rabbit_topic(p_topic uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  rid uuid;
begin
  select rt.id, rt.user_id, rt.title, left(coalesce(rt.body, ''), 80) as body_preview
  into t
  from public.rabbit_topics rt
  where rt.id = p_topic;

  rid := public._insert_platform_report(
    'rabbit_topic',
    p_topic::text,
    t.user_id,
    coalesce(t.title, '') || case when t.body_preview <> '' then ' — ' || t.body_preview else '' end,
    p_reason
  );

  insert into public.rabbit_reports (reporter_id, topic_id, reason)
  values (auth.uid(), p_topic, nullif(trim(p_reason), ''));
end;
$$;

create or replace function public.report_rabbit_reply(p_reply uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select rr.id, rr.user_id, rr.topic_id, left(coalesce(rr.body, ''), 100) as body_preview
  into r
  from public.rabbit_replies rr
  where rr.id = p_reply;

  perform public._insert_platform_report(
    'rabbit_reply',
    p_reply::text,
    r.user_id,
    coalesce(r.body_preview, 'Reply'),
    p_reason
  );

  insert into public.rabbit_reports (reporter_id, reply_id, reason)
  values (auth.uid(), p_reply, nullif(trim(p_reason), ''));
end;
$$;

-- Backfill legacy rabbit reports (best-effort).
insert into public.platform_reports (
  reporter_id, reported_user_id, kind, ref_id, preview, reason, status, created_at
)
select
  rr.reporter_id,
  coalesce(t.user_id, rp.user_id),
  case when rr.topic_id is not null then 'rabbit_topic' else 'rabbit_reply' end,
  coalesce(rr.topic_id, rr.reply_id)::text,
  coalesce(t.title, left(rp.body, 80), 'Report'),
  rr.reason,
  'open',
  rr.created_at
from public.rabbit_reports rr
left join public.rabbit_topics t on t.id = rr.topic_id
left join public.rabbit_replies rp on rp.id = rr.reply_id
where not exists (
  select 1 from public.platform_reports pr
  where pr.kind = case when rr.topic_id is not null then 'rabbit_topic' else 'rabbit_reply' end
    and pr.ref_id = coalesce(rr.topic_id, rr.reply_id)::text
    and pr.reporter_id = rr.reporter_id
    and pr.created_at = rr.created_at
);

create or replace function public.list_platform_reports(p_status text default 'open')
returns table (
  id uuid,
  kind text,
  ref_id text,
  preview text,
  reason text,
  status text,
  reporter_id uuid,
  reporter_name text,
  reported_user_id uuid,
  reported_name text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    pr.id,
    pr.kind,
    pr.ref_id,
    pr.preview,
    pr.reason,
    pr.status,
    pr.reporter_id,
    coalesce(rp.silly_name, 'a fren') as reporter_name,
    pr.reported_user_id,
    coalesce(up.silly_name, 'unknown') as reported_name,
    pr.created_at
  from public.platform_reports pr
  left join public.profiles rp on rp.id = pr.reporter_id
  left join public.profiles up on up.id = pr.reported_user_id
  where public.am_i_platform_staff()
    and (p_status is null or pr.status = p_status)
  order by pr.created_at desc
  limit 100;
$$;

create or replace function public.platform_report_open_count()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)
  from public.platform_reports pr
  where public.am_i_platform_staff()
    and pr.status = 'open';
$$;

create or replace function public.resolve_platform_report(
  p_id uuid,
  p_status text default 'dismissed',
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.am_i_platform_staff() then
    raise exception 'Staff only';
  end if;
  if p_status not in ('dismissed', 'actioned') then
    raise exception 'Invalid status';
  end if;
  update public.platform_reports
  set
    status = p_status,
    resolved_at = now(),
    resolved_by = auth.uid(),
    resolution_note = nullif(trim(p_note), '')
  where id = p_id;
end;
$$;

-- ── Suspend / unsuspend ─────────────────────────────────────────────────────

create or replace function public.suspend_platform_user(
  p_user uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if not public.am_i_platform_staff() then
    raise exception 'Staff only';
  end if;
  if p_user is null then
    raise exception 'No user';
  end if;
  if p_user = uid then
    raise exception 'Cannot suspend yourself';
  end if;
  if exists (
    select 1 from public.profiles p
    where p.id = p_user and (p.is_founder or p.is_cofounder)
  ) then
    raise exception 'Cannot suspend staff';
  end if;

  update public.profiles
  set
    suspended_at = now(),
    suspended_reason = nullif(trim(p_reason), ''),
    suspended_by = uid
  where id = p_user;

  -- Social graph
  delete from public.follows
  where follower_id = p_user or following_id = p_user;

  -- Rabbit Hole follows
  delete from public.rabbit_topic_follows where user_id = p_user;

  -- Saved playlists (theirs + saves of their playlists)
  delete from public.saved_playlists where user_id = p_user;
  delete from public.saved_playlists sp
  using public.profile_playlists pp
  where sp.playlist_id = pp.id and pp.user_id = p_user;

  -- Hide their public forum threads
  update public.rabbit_topics set hidden = true where user_id = p_user;
  update public.rabbit_replies set hidden = true where user_id = p_user;

  -- Mark open reports about this user as actioned
  update public.platform_reports
  set status = 'actioned', resolved_at = now(), resolved_by = uid,
      resolution_note = coalesce(resolution_note, 'User suspended')
  where reported_user_id = p_user and status = 'open';
end;
$$;

create or replace function public.unsuspend_platform_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.am_i_platform_staff() then
    raise exception 'Staff only';
  end if;
  update public.profiles
  set suspended_at = null, suspended_reason = null, suspended_by = null
  where id = p_user;
end;
$$;

-- Co-founder promotion (founders only — not co-founders)
create or replace function public.set_user_cofounder(p_user uuid, p_value boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_founder and p.suspended_at is null
  ) then
    raise exception 'Founder only';
  end if;
  if p_user is null then
    raise exception 'No user';
  end if;
  if exists (select 1 from public.profiles p where p.id = p_user and p.is_founder) then
    raise exception 'Already a founder';
  end if;
  update public.profiles
  set is_cofounder = coalesce(p_value, true)
  where id = p_user;
end;
$$;

create or replace function public.get_my_account_status()
returns table (
  suspended boolean,
  suspended_reason text,
  is_founder boolean,
  is_cofounder boolean,
  is_platform_staff boolean,
  open_reports bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (p.suspended_at is not null) as suspended,
    p.suspended_reason,
    coalesce(p.is_founder, false) as is_founder,
    coalesce(p.is_cofounder, false) as is_cofounder,
    coalesce(p.is_founder or p.is_cofounder, false) as is_platform_staff,
    case
      when coalesce(p.is_founder or p.is_cofounder, false) then (
        select count(*) from public.platform_reports pr where pr.status = 'open'
      )
      else 0::bigint
    end as open_reports
  from public.profiles p
  where p.id = auth.uid();
$$;

-- Extend notification feed (preserve owl + rabbit + staff report alerts).
drop function if exists public.list_notifications();

create or replace function public.list_notifications()
returns table (
  id uuid,
  type text,
  actor_id uuid,
  actor_name text,
  actor_avatar_type text,
  actor_avatar_url text,
  post_id uuid,
  post_preview text,
  cave_id text,
  cave_name text,
  conversation_id uuid,
  dm_preview text,
  rabbit_topic_id uuid,
  rabbit_preview text,
  owl_letter_id uuid,
  owl_letter_anonymous boolean,
  platform_report_id uuid,
  read boolean,
  created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select
    n.id,
    n.type,
    case
      when n.type = 'owl_letter' and (n.owl_letter_anonymous or coalesce(ol.anonymous, false)) then null
      else n.actor_id
    end as actor_id,
    case
      when n.type = 'owl_letter' and (n.owl_letter_anonymous or coalesce(ol.anonymous, false)) then null
      else coalesce(pr.silly_name, 'a fren')
    end as actor_name,
    case
      when n.type = 'owl_letter' and (n.owl_letter_anonymous or coalesce(ol.anonymous, false)) then null
      else coalesce(pr.avatar_type, 'frog')
    end as actor_avatar_type,
    case
      when n.type = 'owl_letter' and (n.owl_letter_anonymous or coalesce(ol.anonymous, false)) then null
      else pr.avatar_url
    end as actor_avatar_url,
    n.post_id,
    left(coalesce(po.body, ''), 80) as post_preview,
    n.cave_id,
    n.cave_name,
    n.conversation_id,
    n.dm_preview,
    n.rabbit_topic_id,
    n.rabbit_preview,
    n.owl_letter_id,
    (n.type = 'owl_letter' and (n.owl_letter_anonymous or coalesce(ol.anonymous, false))) as owl_letter_anonymous,
    n.platform_report_id,
    n.read, n.created_at
  from public.notifications n
  left join public.owl_letters ol on ol.id = n.owl_letter_id
  left join public.profiles pr on pr.id = n.actor_id
  left join public.posts po on po.id = n.post_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit 100;
$$;

grant execute on function public.am_i_platform_staff() to authenticated;
grant execute on function public.assert_active_user() to authenticated;
grant execute on function public.file_platform_report(text, text, uuid, text, text) to authenticated;
grant execute on function public.list_platform_reports(text) to authenticated;
grant execute on function public.platform_report_open_count() to authenticated;
grant execute on function public.resolve_platform_report(uuid, text, text) to authenticated;
grant execute on function public.suspend_platform_user(uuid, text) to authenticated;
grant execute on function public.unsuspend_platform_user(uuid) to authenticated;
grant execute on function public.set_user_cofounder(uuid, boolean) to authenticated;
grant execute on function public.get_my_account_status() to authenticated;
grant execute on function public.list_notifications() to authenticated;

notify pgrst, 'reload schema';
