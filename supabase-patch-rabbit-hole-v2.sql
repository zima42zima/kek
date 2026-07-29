-- Rabbit Hole v2 — tags, sort, moderation, follows, notifications.
-- Safe to re-run. Run after supabase-patch-rabbit-hole.sql.

alter table public.rabbit_topics add column if not exists tag text;
alter table public.rabbit_topics add column if not exists hidden boolean default false;
alter table public.rabbit_topics add column if not exists pinned boolean default false;
alter table public.rabbit_topics add column if not exists anonymous boolean default false;

alter table public.rabbit_replies add column if not exists anonymous boolean default false;
alter table public.rabbit_replies add column if not exists hidden boolean default false;

create table if not exists public.rabbit_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users on delete cascade not null,
  topic_id uuid references public.rabbit_topics(id) on delete cascade,
  reply_id uuid references public.rabbit_replies(id) on delete cascade,
  reason text,
  created_at timestamptz default now(),
  check (topic_id is not null or reply_id is not null)
);

create table if not exists public.rabbit_topic_follows (
  topic_id uuid references public.rabbit_topics(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  primary key (topic_id, user_id)
);

create index if not exists rabbit_topics_tag_idx on public.rabbit_topics (tag, updated_at desc);
create index if not exists rabbit_topic_follows_user_idx on public.rabbit_topic_follows (user_id);

grant select, insert on public.rabbit_reports to authenticated;
grant select, insert, delete on public.rabbit_topic_follows to authenticated;

alter table public.rabbit_reports enable row level security;
alter table public.rabbit_topic_follows enable row level security;

drop policy if exists "Users file rabbit reports" on public.rabbit_reports;
create policy "Users file rabbit reports"
  on public.rabbit_reports for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "Users manage own rabbit follows" on public.rabbit_topic_follows;
create policy "Users manage own rabbit follows"
  on public.rabbit_topic_follows for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.notifications add column if not exists rabbit_topic_id uuid references public.rabbit_topics(id) on delete cascade;
alter table public.notifications add column if not exists rabbit_preview text;

create or replace function public.am_i_rabbit_mod()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select p.is_founder from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

drop function if exists public.list_rabbit_topics();
drop function if exists public.list_rabbit_topics(text, text);

create or replace function public.list_rabbit_topics(
  p_sort text default 'active',
  p_tag text default null
)
returns table (
  id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  title text,
  body text,
  tag text,
  pinned boolean,
  anonymous boolean,
  hidden boolean,
  created_at timestamptz,
  updated_at timestamptz,
  reply_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id,
    t.user_id,
    t.author_name,
    t.avatar_type,
    t.avatar_url,
    t.title,
    t.body,
    t.tag,
    coalesce(t.pinned, false) as pinned,
    coalesce(t.anonymous, false) as anonymous,
    coalesce(t.hidden, false) as hidden,
    t.created_at,
    t.updated_at,
    (select count(*) from public.rabbit_replies r where r.topic_id = t.id and coalesce(r.hidden, false) = false) as reply_count
  from public.rabbit_topics t
  where (
    coalesce(t.hidden, false) = false
    or public.am_i_rabbit_mod()
  )
  and (p_tag is null or nullif(trim(p_tag), '') is null or t.tag = p_tag)
  order by
    coalesce(t.pinned, false) desc,
    case
      when p_sort = 'new' then t.created_at
      else t.updated_at
    end desc,
    case when p_sort = 'hot' then (
      select count(*) from public.rabbit_replies r where r.topic_id = t.id and coalesce(r.hidden, false) = false
    ) else 0 end desc,
    t.created_at desc
  limit 100;
$$;

drop function if exists public.get_rabbit_topic(uuid);

create or replace function public.get_rabbit_topic(p_id uuid)
returns table (
  id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  title text,
  body text,
  tag text,
  pinned boolean,
  anonymous boolean,
  hidden boolean,
  created_at timestamptz,
  updated_at timestamptz,
  reply_count bigint,
  i_follow boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id,
    t.user_id,
    t.author_name,
    t.avatar_type,
    t.avatar_url,
    t.title,
    t.body,
    t.tag,
    coalesce(t.pinned, false) as pinned,
    coalesce(t.anonymous, false) as anonymous,
    coalesce(t.hidden, false) as hidden,
    t.created_at,
    t.updated_at,
    (select count(*) from public.rabbit_replies r where r.topic_id = t.id and coalesce(r.hidden, false) = false) as reply_count,
    exists (
      select 1 from public.rabbit_topic_follows f
      where f.topic_id = t.id and f.user_id = auth.uid()
    ) as i_follow
  from public.rabbit_topics t
  where t.id = p_id
    and (coalesce(t.hidden, false) = false or public.am_i_rabbit_mod());
$$;

drop function if exists public.list_rabbit_replies(uuid);

create or replace function public.list_rabbit_replies(p_topic uuid)
returns table (
  id uuid,
  topic_id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  anonymous boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, r.topic_id, r.user_id, r.author_name, r.avatar_type, r.avatar_url, r.body,
         coalesce(r.anonymous, false) as anonymous, r.created_at
  from public.rabbit_replies r
  where r.topic_id = p_topic
    and (coalesce(r.hidden, false) = false or public.am_i_rabbit_mod())
  order by r.created_at asc
  limit 300;
$$;

drop function if exists public.create_rabbit_topic(text, text, text, text, text);

create or replace function public.create_rabbit_topic(
  p_title text,
  p_body text default null,
  p_author_name text default null,
  p_avatar_type text default 'frog',
  p_avatar_url text default null,
  p_tag text default null,
  p_anonymous boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  display_name text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(p_title), '') is null then raise exception 'Topic needs a title'; end if;

  display_name := case
    when coalesce(p_anonymous, false) then 'anonymous fren'
    else p_author_name
  end;

  insert into public.rabbit_topics (
    user_id, author_name, avatar_type, avatar_url, title, body, tag, anonymous
  )
  values (
    uid,
    display_name,
    case when coalesce(p_anonymous, false) then 'frog' else coalesce(p_avatar_type, 'frog') end,
    case when coalesce(p_anonymous, false) then null else p_avatar_url end,
    trim(p_title),
    nullif(trim(p_body), ''),
    nullif(trim(p_tag), ''),
    coalesce(p_anonymous, false)
  )
  returning id into new_id;

  return new_id;
end;
$$;

drop function if exists public.create_rabbit_reply(uuid, text, text, text, text);

create or replace function public.create_rabbit_reply(
  p_topic uuid,
  p_body text,
  p_author_name text default null,
  p_avatar_type text default 'frog',
  p_avatar_url text default null,
  p_anonymous boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  display_name text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(p_body), '') is null then raise exception 'Reply cannot be empty'; end if;
  if not exists (select 1 from public.rabbit_topics where id = p_topic and coalesce(hidden, false) = false) then
    raise exception 'Topic not found';
  end if;

  display_name := case
    when coalesce(p_anonymous, false) then 'anonymous fren'
    else p_author_name
  end;

  insert into public.rabbit_replies (
    topic_id, user_id, author_name, avatar_type, avatar_url, body, anonymous
  )
  values (
    p_topic,
    uid,
    display_name,
    case when coalesce(p_anonymous, false) then 'frog' else coalesce(p_avatar_type, 'frog') end,
    case when coalesce(p_anonymous, false) then null else p_avatar_url end,
    trim(p_body),
    coalesce(p_anonymous, false)
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.mod_hide_rabbit_topic(p_id uuid, p_hidden boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.am_i_rabbit_mod() then raise exception 'Moderator only'; end if;
  update public.rabbit_topics set hidden = coalesce(p_hidden, true) where id = p_id;
end;
$$;

create or replace function public.mod_pin_rabbit_topic(p_id uuid, p_pinned boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.am_i_rabbit_mod() then raise exception 'Moderator only'; end if;
  update public.rabbit_topics set pinned = coalesce(p_pinned, true) where id = p_id;
end;
$$;

create or replace function public.report_rabbit_topic(p_topic uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.rabbit_reports (reporter_id, topic_id, reason)
  values (uid, p_topic, nullif(trim(p_reason), ''));
end;
$$;

create or replace function public.report_rabbit_reply(p_reply uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.rabbit_reports (reporter_id, reply_id, reason)
  values (uid, p_reply, nullif(trim(p_reason), ''));
end;
$$;

create or replace function public.toggle_rabbit_topic_follow(p_topic uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
  following boolean;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.rabbit_topic_follows where topic_id = p_topic and user_id = uid) then
    delete from public.rabbit_topic_follows where topic_id = p_topic and user_id = uid;
    following := false;
  else
    insert into public.rabbit_topic_follows (topic_id, user_id) values (p_topic, uid);
    following := true;
  end if;
  return following;
end;
$$;

create or replace function public.tg_notify_rabbit_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  topic_title text;
  preview text;
begin
  select t.user_id, t.title into owner, topic_title
  from public.rabbit_topics t where t.id = new.topic_id;

  preview := left(coalesce(topic_title, 'a rabbit hole topic'), 80);

  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, rabbit_topic_id, rabbit_preview)
    values (owner, new.user_id, 'rabbit_reply', new.topic_id, preview);
  end if;

  insert into public.notifications (user_id, actor_id, type, rabbit_topic_id, rabbit_preview)
  select f.user_id, new.user_id, 'rabbit_follow', new.topic_id, preview
  from public.rabbit_topic_follows f
  where f.topic_id = new.topic_id
    and f.user_id <> new.user_id
    and f.user_id <> coalesce(owner, '00000000-0000-0000-0000-000000000000'::uuid);

  return new;
end;
$$;

drop trigger if exists on_rabbit_reply_notify on public.rabbit_replies;
create trigger on_rabbit_reply_notify
  after insert on public.rabbit_replies
  for each row execute function public.tg_notify_rabbit_reply();

-- Extend notification feed for rabbit hole events.
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
  read boolean,
  created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select
    n.id, n.type, n.actor_id,
    coalesce(pr.silly_name, 'a fren') as actor_name,
    coalesce(pr.avatar_type, 'frog') as actor_avatar_type,
    pr.avatar_url as actor_avatar_url,
    n.post_id,
    left(coalesce(po.body, ''), 80) as post_preview,
    n.cave_id,
    n.cave_name,
    n.conversation_id,
    n.dm_preview,
    n.rabbit_topic_id,
    n.rabbit_preview,
    n.read, n.created_at
  from public.notifications n
  left join public.profiles pr on pr.id = n.actor_id
  left join public.posts po on po.id = n.post_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit 100;
$$;

grant execute on function public.am_i_rabbit_mod() to authenticated;
grant execute on function public.list_rabbit_topics(text, text) to authenticated;
grant execute on function public.get_rabbit_topic(uuid) to authenticated;
grant execute on function public.list_rabbit_replies(uuid) to authenticated;
grant execute on function public.create_rabbit_topic(text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.create_rabbit_reply(uuid, text, text, text, text, boolean) to authenticated;
grant execute on function public.mod_hide_rabbit_topic(uuid, boolean) to authenticated;
grant execute on function public.mod_pin_rabbit_topic(uuid, boolean) to authenticated;
grant execute on function public.report_rabbit_topic(uuid, text) to authenticated;
grant execute on function public.report_rabbit_reply(uuid, text) to authenticated;
grant execute on function public.toggle_rabbit_topic_follow(uuid) to authenticated;
grant execute on function public.list_notifications() to authenticated;

notify pgrst, 'reload schema';
