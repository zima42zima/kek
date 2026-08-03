-- Owl Post (Phase 1) — sealed letters, approve, print-only reveal.
-- Safe to re-run. Run in Supabase → SQL Editor.

create table if not exists public.owl_settings (
  user_id uuid primary key references auth.users on delete cascade,
  enabled boolean not null default false,
  accept_anonymous boolean not null default false,
  require_preapproval boolean not null default true,
  only_following boolean not null default false,
  updated_at timestamptz default now()
);

create table if not exists public.owl_letters (
  id uuid primary key default gen_random_uuid(),
  from_user uuid references auth.users on delete set null,
  to_user uuid references auth.users on delete cascade not null,
  anonymous boolean not null default false,
  from_display text,
  body text not null,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'printed', 'declined')),
  created_at timestamptz default now(),
  approved_at timestamptz,
  printed_at timestamptz,
  declined_at timestamptz
);

create index if not exists owl_letters_to_status_idx
  on public.owl_letters (to_user, status, created_at desc);

create index if not exists owl_letters_from_idx
  on public.owl_letters (from_user, created_at desc);

grant select, insert, update, delete on public.owl_settings to authenticated;
grant select, insert, update, delete on public.owl_letters to authenticated;

alter table public.owl_settings enable row level security;
alter table public.owl_letters enable row level security;

drop policy if exists "Owl settings readable" on public.owl_settings;
create policy "Owl settings readable"
  on public.owl_settings for select to authenticated using (true);

drop policy if exists "Users manage own owl settings" on public.owl_settings;
create policy "Users manage own owl settings"
  on public.owl_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Recipients and senders read own letters" on public.owl_letters;
create policy "Recipients and senders read own letters"
  on public.owl_letters for select to authenticated
  using (to_user = auth.uid() or from_user = auth.uid());

drop policy if exists "Users send owl letters" on public.owl_letters;
create policy "Users send owl letters"
  on public.owl_letters for insert to authenticated
  with check (from_user = auth.uid());

drop policy if exists "Recipients update own letters" on public.owl_letters;
create policy "Recipients update own letters"
  on public.owl_letters for update to authenticated
  using (to_user = auth.uid());

alter table public.notifications add column if not exists owl_letter_id uuid references public.owl_letters(id) on delete cascade;
alter table public.notifications add column if not exists owl_letter_anonymous boolean not null default false;

create or replace function public.ensure_owl_settings_row(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.owl_settings (user_id)
  values (p_user)
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.get_public_owl_status(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select s.enabled from public.owl_settings s where s.user_id = p_user),
    false
  );
$$;

create or replace function public.get_my_owl_settings()
returns table (
  enabled boolean,
  accept_anonymous boolean,
  require_preapproval boolean,
  only_following boolean,
  pending_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(s.enabled, false) as enabled,
    coalesce(s.accept_anonymous, false) as accept_anonymous,
    coalesce(s.require_preapproval, true) as require_preapproval,
    coalesce(s.only_following, false) as only_following,
    (
      select count(*) from public.owl_letters l
      where l.to_user = auth.uid() and l.status in ('pending', 'ready')
    ) as pending_count
  from (select auth.uid() as uid) me
  left join public.owl_settings s on s.user_id = me.uid;
$$;

create or replace function public.update_my_owl_settings(
  p_enabled boolean default null,
  p_accept_anonymous boolean default null,
  p_require_preapproval boolean default null,
  p_only_following boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  perform public.ensure_owl_settings_row(uid);
  update public.owl_settings set
    enabled = coalesce(p_enabled, enabled),
    accept_anonymous = coalesce(p_accept_anonymous, accept_anonymous),
    require_preapproval = coalesce(p_require_preapproval, require_preapproval),
    only_following = coalesce(p_only_following, only_following),
    updated_at = now()
  where user_id = uid;
end;
$$;

create or replace function public.can_send_owl_to(p_to uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
  s public.owl_settings%rowtype;
  follows boolean;
begin
  if uid is null or p_to is null or uid = p_to then return false; end if;
  select * into s from public.owl_settings where user_id = p_to;
  if not found or not s.enabled then return false; end if;
  if s.only_following then
    select exists (
      select 1 from public.follows f
      where f.follower_id = p_to and f.following_id = uid
    ) into follows;
    if not follows then return false; end if;
  end if;
  return true;
end;
$$;

create or replace function public.send_owl_letter(
  p_to uuid,
  p_body text,
  p_anonymous boolean default false,
  p_from_display text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s public.owl_settings%rowtype;
  new_id uuid;
  initial_status text;
  display_name text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(p_body), '') is null then raise exception 'Letter cannot be empty'; end if;
  if not public.can_send_owl_to(p_to) then raise exception 'This fren is not accepting letters'; end if;

  select * into s from public.owl_settings where user_id = p_to;

  if coalesce(p_anonymous, false) and not s.accept_anonymous then
    raise exception 'This fren does not accept anonymous letters';
  end if;

  display_name := case
    when coalesce(p_anonymous, false) then 'anonymous fren'
    else coalesce(nullif(trim(p_from_display), ''), 'a fren')
  end;

  initial_status := case
    when s.require_preapproval then 'pending'
    else 'ready'
  end;

  insert into public.owl_letters (from_user, to_user, anonymous, from_display, body, status, approved_at)
  values (
    uid,
    p_to,
    coalesce(p_anonymous, false),
    display_name,
    trim(p_body),
    initial_status,
    case when initial_status = 'ready' then now() else null end
  )
  returning id into new_id;

  insert into public.notifications (user_id, actor_id, type, owl_letter_id, owl_letter_anonymous)
  values (
    p_to,
    case when coalesce(p_anonymous, false) then null else uid end,
    'owl_letter',
    new_id,
    coalesce(p_anonymous, false)
  );

  return new_id;
end;
$$;

create or replace function public.list_received_owl_letters()
returns table (
  id uuid,
  from_user uuid,
  from_display text,
  anonymous boolean,
  status text,
  body_length int,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    l.id,
    case when l.anonymous then null else l.from_user end as from_user,
    l.from_display,
    l.anonymous,
    l.status,
    length(l.body) as body_length,
    l.created_at
  from public.owl_letters l
  where l.to_user = auth.uid()
  order by l.created_at desc
  limit 100;
$$;

create or replace function public.list_sent_owl_letters()
returns table (
  id uuid,
  to_user uuid,
  to_name text,
  anonymous boolean,
  status text,
  created_at timestamptz,
  printed_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    l.id,
    l.to_user,
    coalesce(pr.silly_name, 'a fren') as to_name,
    l.anonymous,
    l.status,
    l.created_at,
    l.printed_at
  from public.owl_letters l
  left join public.profiles pr on pr.id = l.to_user
  where l.from_user = auth.uid()
  order by l.created_at desc
  limit 100;
$$;

create or replace function public.approve_owl_letter(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  update public.owl_letters
  set status = 'ready', approved_at = now()
  where id = p_id and to_user = uid and status = 'pending';
  if not found then raise exception 'Letter not found or already handled'; end if;
end;
$$;

create or replace function public.decline_owl_letter(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  update public.owl_letters
  set status = 'declined', declined_at = now()
  where id = p_id and to_user = uid and status in ('pending', 'ready');
  if not found then raise exception 'Letter not found or already handled'; end if;
end;
$$;

create or replace function public.get_owl_letter_for_print(p_id uuid)
returns table (body text, from_display text)
language sql
security definer
set search_path = public
stable
as $$
  select l.body, l.from_display
  from public.owl_letters l
  where l.id = p_id
    and l.to_user = auth.uid()
    and l.status = 'ready';
$$;

create or replace function public.mark_owl_letter_printed(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  update public.owl_letters
  set status = 'printed', printed_at = now()
  where id = p_id and to_user = uid and status = 'ready';
  if not found then raise exception 'Letter not ready to print'; end if;
end;
$$;

-- Public profile card includes owl post open/closed.
drop function if exists public.get_profile_card(uuid);

create function public.get_profile_card(p_user uuid)
returns table (
  id uuid,
  name text,
  one_human_thing text,
  bio text,
  avatar_type text,
  avatar_url text,
  is_founder boolean,
  cosmos_url text,
  owl_post_open boolean,
  following bigint,
  followers bigint,
  i_follow boolean
)
language sql security definer set search_path = public stable as $$
  select
    pr.id,
    coalesce(pr.silly_name, 'a fren') as name,
    pr.one_human_thing,
    pr.bio,
    coalesce(pr.avatar_type, 'frog') as avatar_type,
    pr.avatar_url,
    coalesce(pr.is_founder, false) as is_founder,
    pr.cosmos_url,
    public.get_public_owl_status(pr.id) as owl_post_open,
    (select count(*) from public.follows where follower_id = pr.id) as following,
    (select count(*) from public.follows where following_id = pr.id) as followers,
    exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.following_id = pr.id
    ) as i_follow
  from public.profiles pr
  where pr.id = p_user;
$$;

-- Notifications feed includes owl letters.
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
    n.read, n.created_at
  from public.notifications n
  left join public.owl_letters ol on ol.id = n.owl_letter_id
  left join public.profiles pr on pr.id = n.actor_id
  left join public.posts po on po.id = n.post_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit 100;
$$;

grant execute on function public.ensure_owl_settings_row(uuid) to authenticated;
grant execute on function public.get_public_owl_status(uuid) to authenticated;
grant execute on function public.get_my_owl_settings() to authenticated;
grant execute on function public.update_my_owl_settings(boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.can_send_owl_to(uuid) to authenticated;
grant execute on function public.send_owl_letter(uuid, text, boolean, text) to authenticated;
grant execute on function public.list_received_owl_letters() to authenticated;
grant execute on function public.list_sent_owl_letters() to authenticated;
grant execute on function public.approve_owl_letter(uuid) to authenticated;
grant execute on function public.decline_owl_letter(uuid) to authenticated;
grant execute on function public.get_owl_letter_for_print(uuid) to authenticated;
grant execute on function public.mark_owl_letter_printed(uuid) to authenticated;
grant execute on function public.get_profile_card(uuid) to authenticated;
grant execute on function public.list_notifications() to authenticated;

notify pgrst, 'reload schema';
