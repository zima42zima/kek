-- Rabbit Hole — open forum for topics and debates.
-- Safe to re-run. Run in Supabase → SQL Editor.

create table if not exists public.rabbit_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  author_name text,
  avatar_type text default 'frog',
  avatar_url text,
  title text not null,
  body text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.rabbit_replies (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.rabbit_topics(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  author_name text,
  avatar_type text default 'frog',
  avatar_url text,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists rabbit_topics_updated_idx
  on public.rabbit_topics (updated_at desc, created_at desc);

create index if not exists rabbit_replies_topic_idx
  on public.rabbit_replies (topic_id, created_at asc);

grant select, insert, delete on public.rabbit_topics to authenticated;
grant select, insert, delete on public.rabbit_replies to authenticated;

alter table public.rabbit_topics enable row level security;
alter table public.rabbit_replies enable row level security;

drop policy if exists "Rabbit topics readable" on public.rabbit_topics;
create policy "Rabbit topics readable"
  on public.rabbit_topics for select to authenticated using (true);

drop policy if exists "Users create rabbit topics" on public.rabbit_topics;
create policy "Users create rabbit topics"
  on public.rabbit_topics for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users delete own rabbit topics" on public.rabbit_topics;
create policy "Users delete own rabbit topics"
  on public.rabbit_topics for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Rabbit replies readable" on public.rabbit_replies;
create policy "Rabbit replies readable"
  on public.rabbit_replies for select to authenticated using (true);

drop policy if exists "Users create rabbit replies" on public.rabbit_replies;
create policy "Users create rabbit replies"
  on public.rabbit_replies for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users delete own rabbit replies" on public.rabbit_replies;
create policy "Users delete own rabbit replies"
  on public.rabbit_replies for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.touch_rabbit_topic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rabbit_topics
  set updated_at = now()
  where id = new.topic_id;
  return new;
end;
$$;

drop trigger if exists on_rabbit_reply_created on public.rabbit_replies;
create trigger on_rabbit_reply_created
  after insert on public.rabbit_replies
  for each row execute function public.touch_rabbit_topic();

create or replace function public.list_rabbit_topics()
returns table (
  id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  title text,
  body text,
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
    t.created_at,
    t.updated_at,
    (select count(*) from public.rabbit_replies r where r.topic_id = t.id) as reply_count
  from public.rabbit_topics t
  order by t.updated_at desc, t.created_at desc
  limit 100;
$$;

create or replace function public.get_rabbit_topic(p_id uuid)
returns table (
  id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  title text,
  body text,
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
    t.created_at,
    t.updated_at,
    (select count(*) from public.rabbit_replies r where r.topic_id = t.id) as reply_count
  from public.rabbit_topics t
  where t.id = p_id;
$$;

create or replace function public.list_rabbit_replies(p_topic uuid)
returns table (
  id uuid,
  topic_id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, r.topic_id, r.user_id, r.author_name, r.avatar_type, r.avatar_url, r.body, r.created_at
  from public.rabbit_replies r
  where r.topic_id = p_topic
  order by r.created_at asc
  limit 300;
$$;

create or replace function public.create_rabbit_topic(
  p_title text,
  p_body text default null,
  p_author_name text default null,
  p_avatar_type text default 'frog',
  p_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(p_title), '') is null then raise exception 'Topic needs a title'; end if;

  insert into public.rabbit_topics (user_id, author_name, avatar_type, avatar_url, title, body)
  values (
    uid,
    p_author_name,
    coalesce(p_avatar_type, 'frog'),
    p_avatar_url,
    trim(p_title),
    nullif(trim(p_body), '')
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.create_rabbit_reply(
  p_topic uuid,
  p_body text,
  p_author_name text default null,
  p_avatar_type text default 'frog',
  p_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(p_body), '') is null then raise exception 'Reply cannot be empty'; end if;
  if not exists (select 1 from public.rabbit_topics where id = p_topic) then
    raise exception 'Topic not found';
  end if;

  insert into public.rabbit_replies (topic_id, user_id, author_name, avatar_type, avatar_url, body)
  values (
    p_topic,
    uid,
    p_author_name,
    coalesce(p_avatar_type, 'frog'),
    p_avatar_url,
    trim(p_body)
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.delete_my_rabbit_topic(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.rabbit_topics where id = p_id and user_id = uid;
end;
$$;

create or replace function public.delete_my_rabbit_reply(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.rabbit_replies where id = p_id and user_id = uid;
end;
$$;

grant execute on function public.list_rabbit_topics() to authenticated;
grant execute on function public.get_rabbit_topic(uuid) to authenticated;
grant execute on function public.list_rabbit_replies(uuid) to authenticated;
grant execute on function public.create_rabbit_topic(text, text, text, text, text) to authenticated;
grant execute on function public.create_rabbit_reply(uuid, text, text, text, text) to authenticated;
grant execute on function public.delete_my_rabbit_topic(uuid) to authenticated;
grant execute on function public.delete_my_rabbit_reply(uuid) to authenticated;

notify pgrst, 'reload schema';
