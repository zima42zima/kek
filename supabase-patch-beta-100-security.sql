-- Beta 100 — block suspended accounts on writes + tighten people search.
-- Run AFTER supabase-patch-platform-moderation.sql
-- Safe to re-run.

-- ── Suspension enforcement on core writes ───────────────────────────────────

create or replace function public.create_post(
  p_body text default null,
  p_image text default null,
  p_audience text default 'everyone',
  p_tags text[] default '{}',
  p_author_name text default null,
  p_avatar_type text default 'frog',
  p_avatar_url text default null
)
returns setof public.posts
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  perform public.assert_active_user();

  return query
  insert into public.posts (user_id, author_name, avatar_type, avatar_url, body, image, audience, tags)
  values (uid, p_author_name, coalesce(p_avatar_type, 'frog'), p_avatar_url,
          nullif(p_body, ''), p_image, coalesce(p_audience, 'everyone'), coalesce(p_tags, '{}'))
  returning *;
end;
$$;

create or replace function public.create_comment(
  p_post uuid,
  p_body text,
  p_author_name text default null,
  p_avatar_type text default 'frog',
  p_avatar_url text default null
)
returns table (
  id uuid,
  post_id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  perform public.assert_active_user();
  if nullif(trim(p_body), '') is null then raise exception 'Comment cannot be empty'; end if;
  return query
  insert into public.post_comments (post_id, user_id, author_name, avatar_type, avatar_url, body)
  values (p_post, uid, p_author_name, coalesce(p_avatar_type, 'frog'), p_avatar_url, trim(p_body))
  returning *;
end;
$$;

create or replace function public.follow_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  perform public.assert_active_user();
  if p_target is null or p_target = uid then return; end if;
  insert into public.follows (follower_id, following_id)
  values (uid, p_target)
  on conflict do nothing;
end;
$$;

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
  perform public.assert_active_user();
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
  perform public.assert_active_user();

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

create or replace function public.send_cave_message(
  p_cave_id text,
  p_body text default null,
  p_image text default null,
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
  perform public.assert_active_user();
  if not exists (
    select 1 from public.cave_members where cave_id = p_cave_id and user_id = uid
  ) then
    raise exception 'Not a cave member';
  end if;

  insert into public.cave_messages (
    cave_id, author_id, author_name, avatar_type, avatar_url, body, image, sticker
  )
  values (
    p_cave_id, uid, p_author_name, coalesce(p_avatar_type, 'frog'), p_avatar_url,
    nullif(p_body, ''), p_image, p_sticker
  )
  returning id into mid;

  update public.caves set updated_at = now() where id = p_cave_id;
  return mid;
end;
$$;

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
  perform public.assert_active_user();
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
  perform public.assert_active_user();
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
  perform public.assert_active_user();
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
  perform public.assert_active_user();
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
  exception when others then null;
  end;

  return new_id;
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
  if uid is null then raise exception 'Not authenticated'; end if;
  perform public.assert_active_user();

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
    if tries > 25 then raise exception 'Could not generate invite code'; end if;
  end loop;

  insert into public.invites (code, created_by)
  values (new_code, uid);

  return new_code;
end;
$$;

-- ── People search: signed-in only ───────────────────────────────────────────
-- Postgres often grants EXECUTE to PUBLIC; revoke that too or anon key still works.

revoke execute on function public.search_profiles(text, int) from public;
revoke execute on function public.search_profiles(text, int) from anon;
grant execute on function public.search_profiles(text, int) to authenticated;

notify pgrst, 'reload schema';
