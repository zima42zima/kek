-- Run in Supabase → SQL Editor to enable direct messages.
-- Safe to re-run.

alter table public.notifications add column if not exists conversation_id uuid;
alter table public.notifications add column if not exists dm_preview text;

create table if not exists public.dm_conversations (
  id uuid default gen_random_uuid() primary key,
  user_a uuid references auth.users on delete cascade not null,
  user_b uuid references auth.users on delete cascade not null,
  updated_at timestamptz default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

create table if not exists public.dm_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid references public.dm_conversations(id) on delete cascade not null,
  sender_id uuid references auth.users on delete cascade not null,
  author_name text,
  avatar_type text default 'frog',
  avatar_url text,
  body text,
  image text,
  video text,
  sticker text,
  created_at timestamptz default now()
);

create table if not exists public.dm_read_state (
  conversation_id uuid references public.dm_conversations(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  last_read_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

grant all on public.dm_conversations to postgres, service_role;
grant all on public.dm_messages to postgres, service_role;
grant all on public.dm_read_state to postgres, service_role;
grant select on public.dm_conversations to authenticated;
grant select on public.dm_messages to authenticated;
grant select on public.dm_read_state to authenticated;

alter table public.dm_conversations enable row level security;
alter table public.dm_messages enable row level security;
alter table public.dm_read_state enable row level security;

drop policy if exists "Participants see own dm conversations" on public.dm_conversations;
create policy "Participants see own dm conversations"
  on public.dm_conversations for select to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "Participants see dm messages" on public.dm_messages;
create policy "Participants see dm messages"
  on public.dm_messages for select to authenticated
  using (exists (
    select 1 from public.dm_conversations c
    where c.id = dm_messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  ));

drop policy if exists "Users see own dm read state" on public.dm_read_state;
create policy "Users see own dm read state"
  on public.dm_read_state for select to authenticated
  using (auth.uid() = user_id);

create index if not exists dm_conversations_users_idx on public.dm_conversations (user_a, user_b);
create index if not exists dm_messages_conversation_idx on public.dm_messages (conversation_id, created_at);
create index if not exists dm_read_state_user_idx on public.dm_read_state (user_id);

create or replace function public.get_or_create_dm(p_target uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a uuid;
  b uuid;
  cid uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_target is null or p_target = uid then raise exception 'Invalid target'; end if;

  a := least(uid, p_target);
  b := greatest(uid, p_target);

  select id into cid from public.dm_conversations where user_a = a and user_b = b;
  if cid is null then
    insert into public.dm_conversations (user_a, user_b) values (a, b) returning id into cid;
    insert into public.dm_read_state (conversation_id, user_id, last_read_at)
    values (cid, uid, now()), (cid, p_target, now());
  end if;

  return cid;
end;
$$;

create or replace function public.list_my_dm_threads()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_name text,
  other_avatar_type text,
  other_avatar_url text,
  last_body text,
  last_image text,
  last_video text,
  last_sticker text,
  last_at timestamptz,
  unread_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id as conversation_id,
    case when c.user_a = auth.uid() then c.user_b else c.user_a end as other_user_id,
    coalesce(pr.silly_name, 'a fren') as other_name,
    coalesce(pr.avatar_type, 'frog') as other_avatar_type,
    pr.avatar_url as other_avatar_url,
    lm.body as last_body,
    lm.image as last_image,
    lm.video as last_video,
    lm.sticker as last_sticker,
    coalesce(lm.created_at, c.updated_at) as last_at,
    (
      select count(*)
      from public.dm_messages m
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(
          (select rs.last_read_at from public.dm_read_state rs
           where rs.conversation_id = c.id and rs.user_id = auth.uid()),
          '1970-01-01'::timestamptz
        )
    ) as unread_count
  from public.dm_conversations c
  left join public.profiles pr on pr.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  left join lateral (
    select m.body, m.image, m.video, m.sticker, m.created_at
    from public.dm_messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where c.user_a = auth.uid() or c.user_b = auth.uid()
  order by coalesce(lm.created_at, c.updated_at) desc;
$$;

create or replace function public.list_dm_messages(p_conversation_id uuid)
returns table (
  id bigint,
  sender_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  image text,
  video text,
  sticker text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select m.id, m.sender_id, m.author_name, m.avatar_type, m.avatar_url,
         m.body, m.image, m.video, m.sticker, m.created_at
  from public.dm_messages m
  join public.dm_conversations c on c.id = m.conversation_id
  where m.conversation_id = p_conversation_id
    and (c.user_a = auth.uid() or c.user_b = auth.uid())
  order by m.created_at asc
  limit 500;
$$;

create or replace function public.send_dm_message(
  p_conversation_id uuid,
  p_body text default null,
  p_image text default null,
  p_video text default null,
  p_sticker text default null,
  p_author_name text default null,
  p_avatar_type text default 'frog',
  p_avatar_url text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mid bigint;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.dm_conversations c
    where c.id = p_conversation_id
      and (c.user_a = uid or c.user_b = uid)
  ) then
    raise exception 'Not a participant';
  end if;

  insert into public.dm_messages (
    conversation_id, sender_id, author_name, avatar_type, avatar_url,
    body, image, video, sticker
  )
  values (
    p_conversation_id, uid, p_author_name, coalesce(p_avatar_type, 'frog'), p_avatar_url,
    nullif(trim(p_body), ''), p_image, p_video, p_sticker
  )
  returning id into mid;

  update public.dm_conversations set updated_at = now() where id = p_conversation_id;
  return mid;
end;
$$;

create or replace function public.mark_dm_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.dm_read_state (conversation_id, user_id, last_read_at)
  values (p_conversation_id, uid, now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end;
$$;

create or replace function public.tg_notify_dm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  preview text;
begin
  select case when c.user_a = new.sender_id then c.user_b else c.user_a end
  into recipient
  from public.dm_conversations c
  where c.id = new.conversation_id;

  if recipient is null or recipient = new.sender_id then
    return new;
  end if;

  preview := coalesce(
    nullif(trim(new.body), ''),
    case
      when new.image is not null then '📷 photo'
      when new.video is not null then '🎬 video'
      when new.sticker is not null then new.sticker
      else 'sent a message'
    end
  );

  insert into public.notifications (user_id, actor_id, type, conversation_id, dm_preview)
  values (recipient, new.sender_id, 'dm', new.conversation_id, left(preview, 80));

  return new;
end;
$$;

drop trigger if exists on_dm_message_created on public.dm_messages;
create trigger on_dm_message_created
  after insert on public.dm_messages
  for each row execute function public.tg_notify_dm();

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
    n.read, n.created_at
  from public.notifications n
  left join public.profiles pr on pr.id = n.actor_id
  left join public.posts po on po.id = n.post_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit 100;
$$;

grant execute on function public.get_or_create_dm(uuid) to authenticated;
grant execute on function public.list_my_dm_threads() to authenticated;
grant execute on function public.list_dm_messages(uuid) to authenticated;
grant execute on function public.send_dm_message(uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.mark_dm_conversation_read(uuid) to authenticated;
grant execute on function public.list_notifications() to authenticated;

notify pgrst, 'reload schema';
