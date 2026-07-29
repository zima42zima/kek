-- Post reactions (fire / thunder) - separate from aura (post_reactions).
-- Safe to re-run. Run after supabase-patch-live-post-avatars.sql.
--
-- HOW TO RUN (Supabase SQL Editor):
-- 1. New query -> paste this ENTIRE file
-- 2. Cmd+A to select all (do NOT highlight just one function)
-- 3. Run

create table if not exists public.post_feed_reactions (
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  reaction_id text not null,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

grant all on public.post_feed_reactions to postgres, service_role;
grant select, insert, update, delete on public.post_feed_reactions to authenticated;
alter table public.post_feed_reactions enable row level security;

drop policy if exists "Post feed reactions are viewable" on public.post_feed_reactions;
create policy "Post feed reactions are viewable"
  on public.post_feed_reactions for select to authenticated using (true);

drop policy if exists "Users add own post feed reactions" on public.post_feed_reactions;
create policy "Users add own post feed reactions"
  on public.post_feed_reactions for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users update own post feed reactions" on public.post_feed_reactions;
create policy "Users update own post feed reactions"
  on public.post_feed_reactions for update to authenticated using (auth.uid() = user_id);

drop policy if exists "Users remove own post feed reactions" on public.post_feed_reactions;
create policy "Users remove own post feed reactions"
  on public.post_feed_reactions for delete to authenticated using (auth.uid() = user_id);

create index if not exists post_feed_reactions_post_idx on public.post_feed_reactions (post_id);

create or replace function public.post_feed_reactions_json(p_post_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'id', reaction_id,
        'count', cnt,
        'mine', mine
      ) order by cnt desc, reaction_id)
      from (
        select r.reaction_id, count(*)::int as cnt, bool_or(r.user_id = auth.uid()) as mine
        from public.post_feed_reactions r
        where r.post_id = p_post_id
        group by r.reaction_id
      ) agg
    ),
    '[]'::jsonb
  );
$$;

create or replace function public.toggle_post_reaction(
  p_post uuid,
  p_reaction text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rid text := trim(p_reaction);
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if rid is null or rid = '' then raise exception 'Reaction required'; end if;
  if rid not in ('fire', 'thunder', 'hearth') then raise exception 'Invalid reaction'; end if;

  if not exists (select 1 from public.posts p where p.id = p_post) then
    raise exception 'Post not found';
  end if;

  if exists (
    select 1 from public.post_feed_reactions
    where post_id = p_post and user_id = uid and reaction_id = rid
  ) then
    delete from public.post_feed_reactions
    where post_id = p_post and user_id = uid and reaction_id = rid;
  elsif exists (
    select 1 from public.post_feed_reactions
    where post_id = p_post and user_id = uid
  ) then
    update public.post_feed_reactions
    set reaction_id = rid, created_at = now()
    where post_id = p_post and user_id = uid;
  else
    insert into public.post_feed_reactions (post_id, user_id, reaction_id)
    values (p_post, uid, rid);
  end if;

  return public.post_feed_reactions_json(p_post);
end;
$$;

create or replace function public.tg_notify_post_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_owner uuid;
begin
  select user_id into post_owner from public.posts where id = new.post_id;
  if post_owner is not null and post_owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id)
    values (post_owner, new.user_id, 'post_reaction', new.post_id);
  end if;
  return new;
end;
$$;

create or replace function public.tg_unnotify_post_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_owner uuid;
begin
  select user_id into post_owner from public.posts where id = old.post_id;
  if post_owner is not null then
    delete from public.notifications
    where type = 'post_reaction'
      and user_id = post_owner
      and actor_id = old.user_id
      and post_id = old.post_id;
  end if;
  return old;
end;
$$;

drop trigger if exists on_post_feed_reaction_created on public.post_feed_reactions;
create trigger on_post_feed_reaction_created
  after insert on public.post_feed_reactions
  for each row execute function public.tg_notify_post_reaction();

drop trigger if exists on_post_feed_reaction_removed on public.post_feed_reactions;
create trigger on_post_feed_reaction_removed
  after delete on public.post_feed_reactions
  for each row execute function public.tg_unnotify_post_reaction();

drop function if exists public.list_feed_posts();

create or replace function public.list_feed_posts()
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
  comment_count bigint,
  feed_source text,
  shown_by_user_id uuid,
  shown_by_name text,
  shown_at timestamptz,
  feed_sort_at timestamptz,
  i_show_to_frens boolean,
  reactions jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  with feed_items as (
    select
      p.id as post_id,
      p.created_at as sort_at,
      'own'::text as feed_source,
      null::uuid as shown_by_user_id,
      null::text as shown_by_name,
      null::timestamptz as shown_at
    from public.posts p
    where p.user_id = auth.uid()

    union all

    select
      p.id,
      p.created_at,
      'follow',
      null::uuid,
      null::text,
      null::timestamptz
    from public.posts p
    join public.follows f
      on f.following_id = p.user_id and f.follower_id = auth.uid()
    where p.user_id <> auth.uid()
      and p.audience in ('everyone', 'frens')

    union all

    select
      p.id,
      s.created_at,
      'shown',
      s.user_id,
      coalesce(pr_show.silly_name, 'a fren'),
      s.created_at
    from public.post_shows s
    join public.follows f
      on f.following_id = s.user_id and f.follower_id = auth.uid()
    join public.posts p on p.id = s.post_id
    left join public.profiles pr_show on pr_show.id = s.user_id
    where p.user_id <> auth.uid()
      and s.user_id <> auth.uid()
      and (
        p.audience = 'everyone'
        or (
          p.audience = 'frens'
          and exists (
            select 1 from public.follows fa
            where fa.follower_id = auth.uid() and fa.following_id = p.user_id
          )
        )
      )
  ),
  ranked as (
    select distinct on (fi.post_id)
      fi.post_id,
      fi.sort_at,
      fi.feed_source,
      fi.shown_by_user_id,
      fi.shown_by_name,
      fi.shown_at
    from feed_items fi
    order by fi.post_id, fi.sort_at desc
  )
  select
    p.id,
    p.user_id,
    p.author_name,
    coalesce(pr.avatar_type, 'frog') as avatar_type,
    pr.avatar_url as avatar_url,
    p.body,
    p.image,
    p.audience,
    p.tags,
    p.created_at,
    (select count(*) from public.post_reactions r where r.post_id = p.id) as aura_count,
    exists (
      select 1 from public.post_reactions r
      where r.post_id = p.id and r.user_id = auth.uid()
    ) as i_gave_aura,
    exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.following_id = p.user_id
    ) as i_follow_author,
    (select count(*) from public.post_comments c where c.post_id = p.id) as comment_count,
    r.feed_source,
    r.shown_by_user_id,
    r.shown_by_name,
    r.shown_at,
    r.sort_at as feed_sort_at,
    exists (
      select 1 from public.post_shows s
      where s.post_id = p.id and s.user_id = auth.uid()
    ) as i_show_to_frens,
    public.post_feed_reactions_json(p.id) as reactions
  from ranked r
  join public.posts p on p.id = r.post_id
  left join public.profiles pr on pr.id = p.user_id
  order by r.sort_at desc
  limit 200;
$$;

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
  comment_count bigint,
  reactions jsonb
)
language sql security definer set search_path = public stable as $$
  select
    p.id, p.user_id, p.author_name,
    coalesce(pr.avatar_type, 'frog') as avatar_type,
    pr.avatar_url as avatar_url,
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
    (select count(*) from public.post_comments c where c.post_id = p.id) as comment_count,
    public.post_feed_reactions_json(p.id) as reactions
  from public.posts p
  left join public.profiles pr on pr.id = p.user_id
  order by p.created_at desc
  limit 200;
$$;

drop function if exists public.list_posts_by_user(uuid);

create or replace function public.list_posts_by_user(p_user uuid)
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
  comment_count bigint,
  is_pinned boolean,
  reactions jsonb
)
language sql security definer set search_path = public stable as $$
  select
    p.id, p.user_id, p.author_name,
    coalesce(author.avatar_type, 'frog') as avatar_type,
    author.avatar_url as avatar_url,
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
    (select count(*) from public.post_comments c where c.post_id = p.id) as comment_count,
    (owner.pinned_post_id = p.id) as is_pinned,
    public.post_feed_reactions_json(p.id) as reactions
  from public.posts p
  join public.profiles owner on owner.id = p_user
  left join public.profiles author on author.id = p.user_id
  where p.user_id = p_user
  order by (owner.pinned_post_id = p.id) desc, p.created_at desc
  limit 100;
$$;

grant execute on function public.post_feed_reactions_json(uuid) to authenticated;
grant execute on function public.toggle_post_reaction(uuid, text) to authenticated;
grant execute on function public.list_posts() to authenticated;
grant execute on function public.list_feed_posts() to authenticated;
grant execute on function public.list_posts_by_user(uuid) to authenticated;

alter table public.post_feed_reactions replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.post_feed_reactions;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
