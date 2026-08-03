-- MISAO profile fix — run in Supabase → SQL Editor on project matching your .env URL.
-- Safe to re-run. After running, you should see "MISAO profile setup OK" in Results.

-- 0. Add profile columns the app writes to (fixes "column profiles.bio does not exist",
--    which makes Save bio and the location toggle fail silently). Safe to re-run.
alter table public.profiles add column if not exists one_human_thing text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists avatar_type text default 'frog';
alter table public.profiles add column if not exists share_location boolean default false;
alter table public.profiles add column if not exists is_founder boolean default false;
alter table public.profiles add column if not exists cover_url text;

-- 1. Schema usage + table grants (fixes "permission denied for table profiles")
grant usage on schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;

grant all on all tables in schema public to postgres, service_role;
grant select, insert, update on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

grant all on all routines in schema public to postgres, service_role;
grant execute on all routines in schema public to authenticated;

alter default privileges for role postgres in schema public
  grant select, insert, update on tables to authenticated;
alter default privileges for role postgres in schema public
  grant select on tables to anon;
alter default privileges for role postgres in schema public
  grant execute on routines to authenticated;

-- 2. RLS policies
alter table public.profiles enable row level security;
alter table public.invites enable row level security;

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- 3. Auto-create profile on signup (security definer = runs as owner, not auth admin)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, silly_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'silly_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'nameless fren'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Profile RPCs used by the app
create or replace function public.get_my_profile()
returns setof public.profiles
language sql
security definer
set search_path = public
stable
as $$
  select * from public.profiles where id = auth.uid();
$$;

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
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

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
    coalesce(p_is_founder, false)
  )
  on conflict (id) do update set
    silly_name = coalesce(nullif(trim(p_silly_name), ''), p.silly_name),
    one_human_thing = coalesce(p_one_human_thing, p.one_human_thing),
    bio = coalesce(p_bio, p.bio),
    avatar_url = coalesce(p_avatar_url, p.avatar_url),
    avatar_type = coalesce(p_avatar_type, p.avatar_type),
    share_location = coalesce(p_share_location, p.share_location),
    is_founder = coalesce(p_is_founder, p.is_founder);
end;
$$;

-- Cover photo setter (kept separate so the main upsert signature never changes)
create or replace function public.set_my_cover(p_cover_url text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles set cover_url = p_cover_url where id = uid;
end;
$$;

grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.upsert_my_profile(text, text, text, text, text, boolean, boolean) to authenticated;
grant execute on function public.set_my_cover(text) to authenticated;

-- 4b. Posts (persist the feed + photos). Safe to re-run.
create table if not exists public.posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  author_name text,
  avatar_type text default 'frog',
  avatar_url text,
  body text,
  image text,
  audience text default 'everyone',
  tags text[] default '{}',
  created_at timestamptz default now()
);

grant all on public.posts to postgres, service_role;
grant select, insert, delete on public.posts to authenticated;

alter table public.posts enable row level security;

drop policy if exists "Posts are viewable by authenticated users" on public.posts;
create policy "Posts are viewable by authenticated users"
  on public.posts for select to authenticated using (true);

drop policy if exists "Users can create their own posts" on public.posts;
create policy "Users can create their own posts"
  on public.posts for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Users can delete their own posts"
  on public.posts for delete to authenticated using (auth.uid() = user_id);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_user_id_idx on public.posts (user_id);

-- 4b-2. Follows (real following/followers) + post reactions ("aura"). Safe to re-run.
create table if not exists public.follows (
  follower_id uuid references auth.users on delete cascade not null,
  following_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

grant all on public.follows to postgres, service_role;
grant select, insert, delete on public.follows to authenticated;
alter table public.follows enable row level security;

drop policy if exists "Follows are viewable by authenticated users" on public.follows;
create policy "Follows are viewable by authenticated users"
  on public.follows for select to authenticated using (true);

drop policy if exists "Users manage their own follows" on public.follows;
create policy "Users manage their own follows"
  on public.follows for insert to authenticated with check (auth.uid() = follower_id);

drop policy if exists "Users remove their own follows" on public.follows;
create policy "Users remove their own follows"
  on public.follows for delete to authenticated using (auth.uid() = follower_id);

create index if not exists follows_following_idx on public.follows (following_id);
create index if not exists follows_follower_idx on public.follows (follower_id);

create table if not exists public.post_reactions (
  post_id uuid references public.posts on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

grant all on public.post_reactions to postgres, service_role;
grant select, insert, delete on public.post_reactions to authenticated;
alter table public.post_reactions enable row level security;

drop policy if exists "Reactions are viewable by authenticated users" on public.post_reactions;
create policy "Reactions are viewable by authenticated users"
  on public.post_reactions for select to authenticated using (true);

drop policy if exists "Users add their own reactions" on public.post_reactions;
create policy "Users add their own reactions"
  on public.post_reactions for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users remove their own reactions" on public.post_reactions;
create policy "Users remove their own reactions"
  on public.post_reactions for delete to authenticated using (auth.uid() = user_id);

create index if not exists post_reactions_post_idx on public.post_reactions (post_id);

-- Post RPCs (security definer = reliable regardless of table-grant hiccups).
-- list_posts now also returns aura count, whether the viewer gave aura, and
-- whether the viewer follows the author. Return type changed, so drop first.
drop function if exists public.list_posts();
create or replace function public.list_posts()
returns table (
  id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  image text,
  audience text,
  tags text[],
  created_at timestamptz,
  aura_count bigint,
  i_gave_aura boolean,
  i_follow_author boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id, p.user_id, p.author_name, p.avatar_type, p.avatar_url,
    p.body, p.image, p.audience, p.tags, p.created_at,
    (select count(*) from public.post_reactions r where r.post_id = p.id) as aura_count,
    exists (
      select 1 from public.post_reactions r
      where r.post_id = p.id and r.user_id = auth.uid()
    ) as i_gave_aura,
    exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.following_id = p.user_id
    ) as i_follow_author
  from public.posts p
  order by p.created_at desc
  limit 200;
$$;

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
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  return query
  insert into public.posts (user_id, author_name, avatar_type, avatar_url, body, image, audience, tags)
  values (uid, p_author_name, coalesce(p_avatar_type, 'frog'), p_avatar_url,
          nullif(p_body, ''), p_image, coalesce(p_audience, 'everyone'), coalesce(p_tags, '{}'))
  returning *;
end;
$$;

create or replace function public.delete_my_post(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  delete from public.posts where id = p_id and user_id = uid;
end;
$$;

grant execute on function public.list_posts() to authenticated;
grant execute on function public.create_post(text, text, text, text[], text, text, text) to authenticated;
grant execute on function public.delete_my_post(uuid) to authenticated;

-- 4b-3. Social RPCs: follow / unfollow, follow counts, toggle aura. Safe to re-run.
create or replace function public.follow_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_target is null or p_target = uid then
    return;
  end if;
  insert into public.follows (follower_id, following_id)
  values (uid, p_target)
  on conflict do nothing;
end;
$$;

create or replace function public.unfollow_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  delete from public.follows where follower_id = uid and following_id = p_target;
end;
$$;

create or replace function public.follow_counts(p_user uuid)
returns table (following bigint, followers bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from public.follows where follower_id = p_user) as following,
    (select count(*) from public.follows where following_id = p_user) as followers;
$$;

-- Toggle aura on a post; returns the fresh count + whether the viewer now gives aura.
create or replace function public.toggle_aura(p_post uuid)
returns table (aura_count bigint, i_gave_aura boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  had boolean;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select exists (
    select 1 from public.post_reactions where post_id = p_post and user_id = uid
  ) into had;

  if had then
    delete from public.post_reactions where post_id = p_post and user_id = uid;
  else
    insert into public.post_reactions (post_id, user_id)
    values (p_post, uid)
    on conflict do nothing;
  end if;

  return query
    select
      (select count(*) from public.post_reactions where post_id = p_post),
      (not had);
end;
$$;

grant execute on function public.follow_user(uuid) to authenticated;
grant execute on function public.unfollow_user(uuid) to authenticated;
grant execute on function public.follow_counts(uuid) to authenticated;
grant execute on function public.toggle_aura(uuid) to authenticated;

-- 4b-3b. Follower / following lists + a public profile card (with follow-back state).
create or replace function public.list_followers(p_user uuid)
returns table (
  user_id uuid,
  name text,
  avatar_type text,
  avatar_url text,
  bio text,
  i_follow boolean
)
language sql security definer set search_path = public stable as $$
  select
    pr.id,
    coalesce(pr.silly_name, 'a fren') as name,
    coalesce(pr.avatar_type, 'frog') as avatar_type,
    pr.avatar_url,
    pr.bio,
    exists (
      select 1 from public.follows f2
      where f2.follower_id = auth.uid() and f2.following_id = pr.id
    ) as i_follow
  from public.follows f
  join public.profiles pr on pr.id = f.follower_id
  where f.following_id = p_user
  order by f.created_at desc;
$$;

create or replace function public.list_following(p_user uuid)
returns table (
  user_id uuid,
  name text,
  avatar_type text,
  avatar_url text,
  bio text,
  i_follow boolean
)
language sql security definer set search_path = public stable as $$
  select
    pr.id,
    coalesce(pr.silly_name, 'a fren') as name,
    coalesce(pr.avatar_type, 'frog') as avatar_type,
    pr.avatar_url,
    pr.bio,
    exists (
      select 1 from public.follows f2
      where f2.follower_id = auth.uid() and f2.following_id = pr.id
    ) as i_follow
  from public.follows f
  join public.profiles pr on pr.id = f.following_id
  where f.follower_id = p_user
  order by f.created_at desc;
$$;

create or replace function public.get_profile_card(p_user uuid)
returns table (
  id uuid,
  name text,
  one_human_thing text,
  bio text,
  avatar_type text,
  avatar_url text,
  is_founder boolean,
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
    (select count(*) from public.follows where follower_id = pr.id) as following,
    (select count(*) from public.follows where following_id = pr.id) as followers,
    exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.following_id = pr.id
    ) as i_follow
  from public.profiles pr
  where pr.id = p_user;
$$;

grant execute on function public.list_followers(uuid) to authenticated;
grant execute on function public.list_following(uuid) to authenticated;
grant execute on function public.get_profile_card(uuid) to authenticated;

-- 4c. Media storage bucket (post photos, avatars, covers). Safe to re-run.
--     Files live under `${auth.uid}/<prefix>/...`; the bucket is public-read so
--     image URLs load anywhere, but only the owner can write/delete their files.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "Media is publicly readable" on storage.objects;
create policy "Media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'media');

drop policy if exists "Users upload their own media" on storage.objects;
create policy "Users upload their own media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update their own media" on storage.objects;
create policy "Users update their own media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete their own media" on storage.objects;
create policy "Users delete their own media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4b-4. Notifications (follows, aura, and extensible for more). Safe to re-run.
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,   -- recipient
  actor_id uuid references auth.users on delete cascade,            -- who triggered it
  type text not null,                                              -- 'follow' | 'aura' | ...
  post_id uuid references public.posts on delete cascade,
  read boolean default false,
  created_at timestamptz default now()
);

grant all on public.notifications to postgres, service_role;
grant select, update, delete on public.notifications to authenticated;
alter table public.notifications enable row level security;

drop policy if exists "Users see their own notifications" on public.notifications;
create policy "Users see their own notifications"
  on public.notifications for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users update their own notifications" on public.notifications;
create policy "Users update their own notifications"
  on public.notifications for update to authenticated using (auth.uid() = user_id);

drop policy if exists "Users delete their own notifications" on public.notifications;
create policy "Users delete their own notifications"
  on public.notifications for delete to authenticated using (auth.uid() = user_id);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id, read);

-- Triggers: create a notification when someone follows you or gives aura to your
-- post; remove it if they undo the action (keeps the feed tidy).
create or replace function public.tg_notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.follower_id <> new.following_id then
    insert into public.notifications (user_id, actor_id, type)
    values (new.following_id, new.follower_id, 'follow');
  end if;
  return new;
end; $$;

drop trigger if exists on_follow_created on public.follows;
create trigger on_follow_created after insert on public.follows
  for each row execute function public.tg_notify_follow();

create or replace function public.tg_unnotify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications
   where type = 'follow' and user_id = old.following_id and actor_id = old.follower_id;
  return old;
end; $$;

drop trigger if exists on_follow_removed on public.follows;
create trigger on_follow_removed after delete on public.follows
  for each row execute function public.tg_unnotify_follow();

create or replace function public.tg_notify_aura()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id)
    values (owner, new.user_id, 'aura', new.post_id);
  end if;
  return new;
end; $$;

drop trigger if exists on_aura_created on public.post_reactions;
create trigger on_aura_created after insert on public.post_reactions
  for each row execute function public.tg_notify_aura();

create or replace function public.tg_unnotify_aura()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.posts where id = old.post_id;
  if owner is not null then
    delete from public.notifications
     where type = 'aura' and user_id = owner and actor_id = old.user_id and post_id = old.post_id;
  end if;
  return old;
end; $$;

drop trigger if exists on_aura_removed on public.post_reactions;
create trigger on_aura_removed after delete on public.post_reactions
  for each row execute function public.tg_unnotify_aura();

-- Notification RPCs (list_notifications upgraded below with cave_id/cave_name).
create or replace function public.unread_notification_count()
returns bigint language sql security definer set search_path = public stable as $$
  select count(*) from public.notifications where user_id = auth.uid() and read = false;
$$;

create or replace function public.mark_notifications_read()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.notifications set read = true where user_id = auth.uid() and read = false;
end; $$;

grant execute on function public.list_notifications() to authenticated;
grant execute on function public.unread_notification_count() to authenticated;
grant execute on function public.mark_notifications_read() to authenticated;

-- 4b-5. Cave member invites (notify + grant access). Safe to re-run.
alter table public.notifications add column if not exists cave_id text;
alter table public.notifications add column if not exists cave_name text;

create table if not exists public.cave_memberships (
  user_id uuid references auth.users on delete cascade not null,
  cave_id text not null,
  cave_name text not null,
  cave_data jsonb not null default '{}',
  added_by uuid references auth.users on delete set null,
  created_at timestamptz default now(),
  primary key (user_id, cave_id)
);

grant all on public.cave_memberships to postgres, service_role;
grant select on public.cave_memberships to authenticated;
alter table public.cave_memberships enable row level security;

drop policy if exists "Users see own cave memberships" on public.cave_memberships;
create policy "Users see own cave memberships"
  on public.cave_memberships for select to authenticated using (auth.uid() = user_id);

create index if not exists cave_memberships_user_idx on public.cave_memberships (user_id, created_at desc);

-- Notify a user they were added to a cave and store a snapshot so they can open it.
create or replace function public.add_cave_member(
  p_target uuid,
  p_cave_id text,
  p_cave_name text,
  p_cave_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_target is null or p_target = uid then
    return;
  end if;

  insert into public.cave_memberships (user_id, cave_id, cave_name, cave_data, added_by)
  values (p_target, p_cave_id, p_cave_name, coalesce(p_cave_data, '{}'::jsonb), uid)
  on conflict (user_id, cave_id) do update set
    cave_name = excluded.cave_name,
    cave_data = excluded.cave_data,
    added_by = excluded.added_by,
    created_at = now();

  insert into public.notifications (user_id, actor_id, type, cave_id, cave_name)
  values (p_target, uid, 'cave_add', p_cave_id, p_cave_name);
end;
$$;

create or replace function public.list_my_cave_memberships()
returns table (
  cave_id text,
  cave_name text,
  cave_data jsonb,
  added_by uuid,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select cave_id, cave_name, cave_data, added_by, created_at
  from public.cave_memberships
  where user_id = auth.uid()
  order by created_at desc;
$$;

grant execute on function public.add_cave_member(uuid, text, text, jsonb) to authenticated;
grant execute on function public.list_my_cave_memberships() to authenticated;

-- list_notifications now includes cave_id / cave_name for cave_add events.
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
    n.read, n.created_at
  from public.notifications n
  left join public.profiles pr on pr.id = n.actor_id
  left join public.posts po on po.id = n.post_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit 100;
$$;
grant execute on function public.list_notifications() to authenticated;

-- 4b-6. Caves backend (shared chat + profile visibility). Safe to re-run.
create table if not exists public.caves (
  id text primary key,
  owner_id uuid references auth.users on delete cascade not null,
  name text not null,
  emoji text default '🕳️',
  access text default 'invite',
  banned uuid[] default '{}',
  emoji_packs jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.cave_members (
  cave_id text references public.caves(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text default 'member',
  hidden_on_profile boolean default false,
  joined_at timestamptz default now(),
  primary key (cave_id, user_id)
);

create table if not exists public.cave_messages (
  id bigint generated always as identity primary key,
  cave_id text references public.caves(id) on delete cascade not null,
  author_id uuid references auth.users on delete cascade not null,
  author_name text,
  avatar_type text default 'frog',
  avatar_url text,
  body text,
  image text,
  sticker text,
  created_at timestamptz default now()
);

grant all on public.caves to postgres, service_role;
grant all on public.cave_members to postgres, service_role;
grant all on public.cave_messages to postgres, service_role;
grant select on public.caves to authenticated;
grant select on public.cave_members to authenticated;
grant select on public.cave_messages to authenticated;

alter table public.caves enable row level security;
alter table public.cave_members enable row level security;
alter table public.cave_messages enable row level security;

drop policy if exists "Members see their caves" on public.caves;
create policy "Members see their caves"
  on public.caves for select to authenticated
  using (exists (
    select 1 from public.cave_members cm
    where cm.cave_id = caves.id and cm.user_id = auth.uid()
  ));

drop policy if exists "Members see cave membership" on public.cave_members;
create policy "Members see cave membership"
  on public.cave_members for select to authenticated
  using (true);

drop policy if exists "Members see cave messages" on public.cave_messages;
create policy "Members see cave messages"
  on public.cave_messages for select to authenticated
  using (exists (
    select 1 from public.cave_members cm
    where cm.cave_id = cave_messages.cave_id and cm.user_id = auth.uid()
  ));

create index if not exists cave_members_user_idx on public.cave_members (user_id);
create index if not exists cave_messages_cave_idx on public.cave_messages (cave_id, created_at);

-- Upsert a cave row from the client snapshot (owner or member sync).
-- When the owner syncs, member roster is reconciled so kicks/re-adds stay in sync.
create or replace function public.sync_cave(p_cave jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid text := p_cave->>'id';
  owner_id uuid := coalesce((p_cave->>'ownerId')::uuid, uid);
  mem jsonb;
  mem_id uuid;
  roster uuid[] := array[owner_id];
  is_owner boolean := (uid = owner_id);
begin
  if uid is null or cid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.caves (id, owner_id, name, emoji, access, banned, emoji_packs, updated_at)
  values (
    cid,
    owner_id,
    coalesce(p_cave->>'name', 'cave'),
    coalesce(p_cave->>'emoji', '🕳️'),
    coalesce(p_cave->>'access', 'invite'),
    coalesce(
      (
        select array_agg(x::uuid)
        from jsonb_array_elements_text(coalesce(p_cave->'banned', '[]'::jsonb)) as t(x)
        where x ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ),
      '{}'::uuid[]
    ),
    coalesce(p_cave->'emojiPacks', '[]'::jsonb),
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    emoji = excluded.emoji,
    access = case when caves.owner_id = uid then excluded.access else caves.access end,
    banned = case when caves.owner_id = uid then excluded.banned else caves.banned end,
    emoji_packs = case when caves.owner_id = uid then excluded.emoji_packs else caves.emoji_packs end,
    updated_at = now();

  insert into public.cave_members (cave_id, user_id, role)
  values (cid, uid, case when owner_id = uid then 'owner' else 'member' end)
  on conflict (cave_id, user_id) do nothing;

  if is_owner then
    for mem in select value from jsonb_array_elements(coalesce(p_cave->'members', '[]'::jsonb))
    loop
      begin
        mem_id := (mem->>'id')::uuid;
        roster := array_append(roster, mem_id);
        insert into public.cave_members (cave_id, user_id, role)
        values (cid, mem_id, coalesce(mem->>'role', 'member'))
        on conflict (cave_id, user_id) do update set role = excluded.role;
      exception when others then
        continue;
      end;
    end loop;

    select coalesce(array_agg(distinct x), array[owner_id]) into roster
    from unnest(roster) as x;

    delete from public.cave_memberships
    where cave_id = cid and not (user_id = any(roster));

    delete from public.cave_members
    where cave_id = cid and not (user_id = any(roster));
  end if;
end;
$$;

create or replace function public.create_cave_remote(
  p_id text,
  p_name text,
  p_emoji text default '🕳️'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.caves (id, owner_id, name, emoji)
  values (p_id, uid, p_name, coalesce(p_emoji, '🕳️'))
  on conflict (id) do nothing;
  insert into public.cave_members (cave_id, user_id, role)
  values (p_id, uid, 'owner')
  on conflict do nothing;
end;
$$;

create or replace function public.set_cave_profile_hidden(p_cave_id text, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cave_members
  set hidden_on_profile = coalesce(p_hidden, false)
  where cave_id = p_cave_id and user_id = auth.uid();
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

create or replace function public.list_cave_messages(p_cave_id text)
returns table (
  id bigint,
  author_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  image text,
  sticker text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select m.id, m.author_id, m.author_name, m.avatar_type, m.avatar_url,
         m.body, m.image, m.sticker, m.created_at
  from public.cave_messages m
  where m.cave_id = p_cave_id
    and exists (
      select 1 from public.cave_members cm
      where cm.cave_id = p_cave_id and cm.user_id = auth.uid()
    )
  order by m.created_at asc
  limit 500;
$$;

create or replace function public.list_my_caves()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
  result jsonb := '[]'::jsonb;
  cid text;
  cave_obj jsonb;
begin
  if uid is null then return '[]'::jsonb; end if;

  for cid in
    select cm.cave_id from public.cave_members cm where cm.user_id = uid
    order by (select c.updated_at from public.caves c where c.id = cm.cave_id) desc
  loop
    select jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'emoji', c.emoji,
      'ownerId', c.owner_id,
      'access', c.access,
      'banned', to_jsonb(coalesce(c.banned, '{}'::uuid[])),
      'emojiPacks', coalesce(c.emoji_packs, '[]'::jsonb),
      'hiddenOnProfile', coalesce(my.hidden_on_profile, false),
      'members', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', cm2.user_id,
          'name', coalesce(pr.silly_name, 'a fren'),
          'avatarType', coalesce(pr.avatar_type, 'frog'),
          'avatarUrl', pr.avatar_url,
          'role', cm2.role
        ) order by cm2.joined_at)
        from public.cave_members cm2
        left join public.profiles pr on pr.id = cm2.user_id
        where cm2.cave_id = c.id
      ), '[]'::jsonb),
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', m.id,
          'authorId', m.author_id,
          'authorName', m.author_name,
          'avatarType', m.avatar_type,
          'avatarUrl', m.avatar_url,
          'text', m.body,
          'image', m.image,
          'sticker', m.sticker,
          'ts', case
            when m.created_at > now() - interval '45 seconds' then 'just now'
            when m.created_at > now() - interval '1 hour' then floor(extract(epoch from (now() - m.created_at)) / 60)::text || 'm'
            when m.created_at > now() - interval '1 day' then floor(extract(epoch from (now() - m.created_at)) / 3600)::text || 'h'
            else to_char(m.created_at, 'Mon DD')
          end
        ) order by m.created_at)
        from public.cave_messages m
        where m.cave_id = c.id
      ), '[]'::jsonb)
    ) into cave_obj
    from public.caves c
    join public.cave_members my on my.cave_id = c.id and my.user_id = uid
    where c.id = cid;

    result := result || jsonb_build_array(cave_obj);
  end loop;

  return result;
end;
$$;

create or replace function public.list_profile_caves(p_user uuid)
returns table (
  cave_id text,
  name text,
  emoji text,
  access text,
  is_owner boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.emoji, c.access, (c.owner_id = p_user) as is_owner
  from public.cave_members cm
  join public.caves c on c.id = cm.cave_id
  where cm.user_id = p_user
    and coalesce(cm.hidden_on_profile, false) = false
  order by c.updated_at desc;
$$;

-- Upgrade add_cave_member to also write normalized cave tables.
-- Skips non-uuid member ids (dummy/local frens) so invites never fail silently.
create or replace function public.add_cave_member(
  p_target uuid,
  p_cave_id text,
  p_cave_name text,
  p_cave_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mem jsonb;
  mem_id uuid;
  snapshot jsonb := coalesce(p_cave_data, '{}'::jsonb) - 'messages';
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_target is null or p_target = uid then return; end if;

  perform public.sync_cave(p_cave_data);

  if not exists (
    select 1 from public.caves c where c.id = p_cave_id and c.owner_id = uid
  ) then
    raise exception 'Only the cave owner can add members';
  end if;

  update public.caves
  set banned = array_remove(coalesce(banned, '{}'::uuid[]), p_target)
  where id = p_cave_id;

  insert into public.cave_members (cave_id, user_id, role)
  values (p_cave_id, p_target, 'member')
  on conflict (cave_id, user_id) do update set role = 'member';

  for mem in select value from jsonb_array_elements(coalesce(p_cave_data->'members', '[]'::jsonb))
  loop
    begin
      mem_id := (mem->>'id')::uuid;
      insert into public.cave_members (cave_id, user_id, role)
      values (p_cave_id, mem_id, coalesce(mem->>'role', 'member'))
      on conflict (cave_id, user_id) do nothing;
    exception when others then
      continue;
    end;
  end loop;

  insert into public.cave_memberships (user_id, cave_id, cave_name, cave_data, added_by)
  values (p_target, p_cave_id, p_cave_name, snapshot, uid)
  on conflict (user_id, cave_id) do update set
    cave_name = excluded.cave_name,
    cave_data = excluded.cave_data,
    added_by = excluded.added_by,
    created_at = now();

  insert into public.notifications (user_id, actor_id, type, cave_id, cave_name)
  values (p_target, uid, 'cave_add', p_cave_id, p_cave_name);
end;
$$;

-- Owner removes a member (kick or ban). Clears invite row so they lose access.
create or replace function public.remove_cave_member(
  p_cave_id text,
  p_target uuid,
  p_ban boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_target is null or p_target = uid then return; end if;

  if not exists (
    select 1 from public.caves c where c.id = p_cave_id and c.owner_id = uid
  ) then
    raise exception 'Only the cave owner can remove members';
  end if;

  delete from public.cave_memberships where cave_id = p_cave_id and user_id = p_target;
  delete from public.cave_members where cave_id = p_cave_id and user_id = p_target;

  if p_ban then
    update public.caves
    set banned = (
      select coalesce(array_agg(distinct x), '{}'::uuid[])
      from (
        select unnest(coalesce(banned, '{}'::uuid[])) as x
        union
        select p_target
      ) s
    )
    where id = p_cave_id;
  end if;
end;
$$;

grant execute on function public.sync_cave(jsonb) to authenticated;
grant execute on function public.remove_cave_member(text, uuid, boolean) to authenticated;
grant execute on function public.create_cave_remote(text, text, text) to authenticated;
grant execute on function public.set_cave_profile_hidden(text, boolean) to authenticated;
grant execute on function public.send_cave_message(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.list_cave_messages(text) to authenticated;
grant execute on function public.list_my_caves() to authenticated;
grant execute on function public.list_profile_caves(uuid) to authenticated;

-- 4b-8. Emoji reactions on cave messages. Safe to re-run.
create table if not exists public.cave_message_reactions (
  message_id bigint references public.cave_messages(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  primary key (message_id, user_id, emoji)
);

grant all on public.cave_message_reactions to postgres, service_role;
grant select, insert, delete on public.cave_message_reactions to authenticated;
alter table public.cave_message_reactions enable row level security;

drop policy if exists "Cave reactions are viewable by authenticated users" on public.cave_message_reactions;
create policy "Cave reactions are viewable by authenticated users"
  on public.cave_message_reactions for select to authenticated using (true);

drop policy if exists "Users add their own cave reactions" on public.cave_message_reactions;
create policy "Users add their own cave reactions"
  on public.cave_message_reactions for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users remove their own cave reactions" on public.cave_message_reactions;
create policy "Users remove their own cave reactions"
  on public.cave_message_reactions for delete to authenticated using (auth.uid() = user_id);

create index if not exists cave_message_reactions_msg_idx on public.cave_message_reactions (message_id);

create or replace function public.cave_message_reactions_json(p_message_id bigint)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'emoji', emoji,
        'count', cnt,
        'mine', mine
      ) order by cnt desc, emoji)
      from (
        select r.emoji, count(*)::int as cnt, bool_or(r.user_id = auth.uid()) as mine
        from public.cave_message_reactions r
        where r.message_id = p_message_id
        group by r.emoji
      ) agg
    ),
    '[]'::jsonb
  );
$$;

create or replace function public.toggle_cave_message_reaction(
  p_message_id bigint,
  p_cave_id text,
  p_emoji text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  em text := trim(p_emoji);
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if em is null or em = '' then raise exception 'Emoji required'; end if;
  if length(em) > 32 then raise exception 'Emoji too long'; end if;

  if not exists (
    select 1 from public.cave_members cm
    where cm.cave_id = p_cave_id and cm.user_id = uid
  ) then
    raise exception 'Not a cave member';
  end if;

  if not exists (
    select 1 from public.cave_messages m
    where m.id = p_message_id and m.cave_id = p_cave_id
  ) then
    raise exception 'Message not found';
  end if;

  if exists (
    select 1 from public.cave_message_reactions
    where message_id = p_message_id and user_id = uid and emoji = em
  ) then
    delete from public.cave_message_reactions
    where message_id = p_message_id and user_id = uid and emoji = em;
  else
    insert into public.cave_message_reactions (message_id, user_id, emoji)
    values (p_message_id, uid, em);
  end if;

  return public.cave_message_reactions_json(p_message_id);
end;
$$;

drop function if exists public.list_cave_messages(text);
create or replace function public.list_cave_messages(p_cave_id text)
returns table (
  id bigint,
  author_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  image text,
  sticker text,
  created_at timestamptz,
  reactions jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select m.id, m.author_id, m.author_name, m.avatar_type, m.avatar_url,
         m.body, m.image, m.sticker, m.created_at,
         public.cave_message_reactions_json(m.id) as reactions
  from public.cave_messages m
  where m.cave_id = p_cave_id
    and exists (
      select 1 from public.cave_members cm
      where cm.cave_id = p_cave_id and cm.user_id = auth.uid()
    )
  order by m.created_at asc
  limit 500;
$$;

-- Rebuild list_my_caves so synced messages include reactions.
create or replace function public.list_my_caves()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
  result jsonb := '[]'::jsonb;
  cid text;
  cave_obj jsonb;
begin
  if uid is null then return '[]'::jsonb; end if;

  for cid in
    select cm.cave_id from public.cave_members cm where cm.user_id = uid
    order by (select c.updated_at from public.caves c where c.id = cm.cave_id) desc
  loop
    select jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'emoji', c.emoji,
      'ownerId', c.owner_id,
      'access', c.access,
      'banned', to_jsonb(coalesce(c.banned, '{}'::uuid[])),
      'emojiPacks', coalesce(c.emoji_packs, '[]'::jsonb),
      'hiddenOnProfile', coalesce(my.hidden_on_profile, false),
      'members', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', cm2.user_id,
          'name', coalesce(pr.silly_name, 'a fren'),
          'avatarType', coalesce(pr.avatar_type, 'frog'),
          'avatarUrl', pr.avatar_url,
          'role', cm2.role
        ) order by cm2.joined_at)
        from public.cave_members cm2
        left join public.profiles pr on pr.id = cm2.user_id
        where cm2.cave_id = c.id
      ), '[]'::jsonb),
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', m.id,
          'authorId', m.author_id,
          'authorName', m.author_name,
          'avatarType', m.avatar_type,
          'avatarUrl', m.avatar_url,
          'text', m.body,
          'image', m.image,
          'sticker', m.sticker,
          'reactions', public.cave_message_reactions_json(m.id),
          'ts', case
            when m.created_at > now() - interval '45 seconds' then 'just now'
            when m.created_at > now() - interval '1 hour' then floor(extract(epoch from (now() - m.created_at)) / 60)::text || 'm'
            when m.created_at > now() - interval '1 day' then floor(extract(epoch from (now() - m.created_at)) / 3600)::text || 'h'
            else to_char(m.created_at, 'Mon DD')
          end
        ) order by m.created_at)
        from public.cave_messages m
        where m.cave_id = c.id
      ), '[]'::jsonb)
    ) into cave_obj
    from public.caves c
    join public.cave_members my on my.cave_id = c.id and my.user_id = uid
    where c.id = cid;

    result := result || jsonb_build_array(cave_obj);
  end loop;

  return result;
end;
$$;

grant execute on function public.cave_message_reactions_json(bigint) to authenticated;
grant execute on function public.toggle_cave_message_reaction(bigint, text, text) to authenticated;
grant execute on function public.list_cave_messages(text) to authenticated;
grant execute on function public.list_my_caves() to authenticated;

-- 4b-7. Post comments. Safe to re-run.
create table if not exists public.post_comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  author_name text,
  avatar_type text default 'frog',
  avatar_url text,
  body text not null,
  created_at timestamptz default now()
);

grant all on public.post_comments to postgres, service_role;
grant select, insert, delete on public.post_comments to authenticated;
alter table public.post_comments enable row level security;

drop policy if exists "Comments are viewable by authenticated users" on public.post_comments;
create policy "Comments are viewable by authenticated users"
  on public.post_comments for select to authenticated using (true);

drop policy if exists "Users create their own comments" on public.post_comments;
create policy "Users create their own comments"
  on public.post_comments for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users delete their own comments" on public.post_comments;
create policy "Users delete their own comments"
  on public.post_comments for delete to authenticated using (auth.uid() = user_id);

create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

create or replace function public.list_post_comments(p_post uuid)
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
language sql security definer set search_path = public stable as $$
  select c.id, c.post_id, c.user_id, c.author_name, c.avatar_type, c.avatar_url, c.body, c.created_at
  from public.post_comments c
  where c.post_id = p_post
  order by c.created_at asc
  limit 200;
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
  if nullif(trim(p_body), '') is null then raise exception 'Comment cannot be empty'; end if;
  return query
  insert into public.post_comments (post_id, user_id, author_name, avatar_type, avatar_url, body)
  values (p_post, uid, p_author_name, coalesce(p_avatar_type, 'frog'), p_avatar_url, trim(p_body))
  returning *;
end;
$$;

create or replace function public.delete_my_comment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.post_comments where id = p_id and user_id = uid;
end;
$$;

-- Notify post author when someone comments (not on own posts).
create or replace function public.tg_notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id)
    values (owner, new.user_id, 'comment', new.post_id);
  end if;
  return new;
end; $$;

drop trigger if exists on_comment_created on public.post_comments;
create trigger on_comment_created after insert on public.post_comments
  for each row execute function public.tg_notify_comment();

-- list_posts now includes comment_count.
drop function if exists public.list_posts();
create or replace function public.list_posts()
returns table (
  id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  image text,
  audience text,
  tags text[],
  created_at timestamptz,
  aura_count bigint,
  i_gave_aura boolean,
  i_follow_author boolean,
  comment_count bigint
)
language sql security definer set search_path = public stable as $$
  select
    p.id, p.user_id, p.author_name, p.avatar_type, p.avatar_url,
    p.body, p.image, p.audience, p.tags, p.created_at,
    (select count(*) from public.post_reactions r where r.post_id = p.id) as aura_count,
    exists (
      select 1 from public.post_reactions r
      where r.post_id = p.id and r.user_id = auth.uid()
    ) as i_gave_aura,
    exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.following_id = p.user_id
    ) as i_follow_author,
    (select count(*) from public.post_comments c where c.post_id = p.id) as comment_count
  from public.posts p
  order by p.created_at desc
  limit 200;
$$;

grant execute on function public.list_post_comments(uuid) to authenticated;
grant execute on function public.create_comment(uuid, text, text, text, text) to authenticated;
grant execute on function public.delete_my_comment(uuid) to authenticated;
grant execute on function public.list_posts() to authenticated;

-- 4b-10. Direct messages (user-to-user). Safe to re-run.
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
    c.id,
    case when c.user_a = auth.uid() then c.user_b else c.user_a end,
    coalesce(pr.silly_name, 'a fren'),
    coalesce(pr.avatar_type, 'frog'),
    pr.avatar_url,
    lm.body, lm.image, lm.video, lm.sticker,
    coalesce(lm.created_at, c.updated_at),
    (
      select count(*) from public.dm_messages m
      where m.conversation_id = c.id and m.sender_id <> auth.uid()
        and m.created_at > coalesce(
          (select rs.last_read_at from public.dm_read_state rs
           where rs.conversation_id = c.id and rs.user_id = auth.uid()),
          '1970-01-01'::timestamptz)
    )
  from public.dm_conversations c
  left join public.profiles pr on pr.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  left join lateral (
    select m.body, m.image, m.video, m.sticker, m.created_at
    from public.dm_messages m where m.conversation_id = c.id
    order by m.created_at desc limit 1
  ) lm on true
  where c.user_a = auth.uid() or c.user_b = auth.uid()
  order by coalesce(lm.created_at, c.updated_at) desc;
$$;

create or replace function public.list_dm_messages(p_conversation_id uuid)
returns table (
  id bigint, sender_id uuid, author_name text, avatar_type text, avatar_url text,
  body text, image text, video text, sticker text, created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select m.id, m.sender_id, m.author_name, m.avatar_type, m.avatar_url,
         m.body, m.image, m.video, m.sticker, m.created_at
  from public.dm_messages m
  join public.dm_conversations c on c.id = m.conversation_id
  where m.conversation_id = p_conversation_id
    and (c.user_a = auth.uid() or c.user_b = auth.uid())
  order by m.created_at asc limit 500;
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
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); mid bigint;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.dm_conversations c
    where c.id = p_conversation_id and (c.user_a = uid or c.user_b = uid)
  ) then raise exception 'Not a participant'; end if;
  insert into public.dm_messages (
    conversation_id, sender_id, author_name, avatar_type, avatar_url, body, image, video, sticker
  ) values (
    p_conversation_id, uid, p_author_name, coalesce(p_avatar_type, 'frog'), p_avatar_url,
    nullif(trim(p_body), ''), p_image, p_video, p_sticker
  ) returning id into mid;
  update public.dm_conversations set updated_at = now() where id = p_conversation_id;
  return mid;
end;
$$;

create or replace function public.mark_dm_conversation_read(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.dm_read_state (conversation_id, user_id, last_read_at)
  values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end;
$$;

create or replace function public.tg_notify_dm()
returns trigger language plpgsql security definer set search_path = public as $$
declare recipient uuid; preview text;
begin
  select case when c.user_a = new.sender_id then c.user_b else c.user_a end into recipient
  from public.dm_conversations c where c.id = new.conversation_id;
  if recipient is null or recipient = new.sender_id then return new; end if;
  preview := coalesce(nullif(trim(new.body), ''),
    case when new.image is not null then '📷 photo'
         when new.video is not null then '🎬 video'
         when new.sticker is not null then new.sticker
         else 'sent a message' end);
  insert into public.notifications (user_id, actor_id, type, conversation_id, dm_preview)
  values (recipient, new.sender_id, 'dm', new.conversation_id, left(preview, 80));
  return new;
end;
$$;

drop trigger if exists on_dm_message_created on public.dm_messages;
create trigger on_dm_message_created after insert on public.dm_messages
  for each row execute function public.tg_notify_dm();

drop function if exists public.list_notifications();
create or replace function public.list_notifications()
returns table (
  id uuid, type text, actor_id uuid, actor_name text, actor_avatar_type text,
  actor_avatar_url text, post_id uuid, post_preview text, cave_id text, cave_name text,
  conversation_id uuid, dm_preview text, read boolean, created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select n.id, n.type, n.actor_id,
    coalesce(pr.silly_name, 'a fren'), coalesce(pr.avatar_type, 'frog'), pr.avatar_url,
    n.post_id, left(coalesce(po.body, ''), 80), n.cave_id, n.cave_name,
    n.conversation_id, n.dm_preview, n.read, n.created_at
  from public.notifications n
  left join public.profiles pr on pr.id = n.actor_id
  left join public.posts po on po.id = n.post_id
  where n.user_id = auth.uid() order by n.created_at desc limit 100;
$$;

grant execute on function public.get_or_create_dm(uuid) to authenticated;
grant execute on function public.list_my_dm_threads() to authenticated;
grant execute on function public.list_dm_messages(uuid) to authenticated;
grant execute on function public.send_dm_message(uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.mark_dm_conversation_read(uuid) to authenticated;
grant execute on function public.list_notifications() to authenticated;

-- 5. Reload PostgREST schema cache so RPCs are visible immediately
notify pgrst, 'reload schema';

-- 6. Verify setup (should return ok: true)
select
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_my_profile'
  ) as rpc_ready,
  (
    select count(*) = 6 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name in ('one_human_thing', 'bio', 'avatar_url', 'avatar_type', 'share_location', 'is_founder')
  ) as columns_ready,
  has_table_privilege('authenticated', 'public.profiles', 'SELECT') as can_select,
  has_table_privilege('authenticated', 'public.profiles', 'INSERT') as can_insert,
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE') as can_update,
  (
    select relrowsecurity from pg_class
    where oid = 'public.profiles'::regclass
  ) as rls_enabled,
  'MISAO profile setup OK — refresh the app and try Save bio' as message;
