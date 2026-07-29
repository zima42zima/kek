-- Posts & comments show the author's current profile photo (not the snapshot at post time).
-- Safe to re-run. Run after supabase-patch-show-to-frens.sql and supabase-patch-comment-reactions.sql.

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
  i_show_to_frens boolean
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
    ) as i_show_to_frens
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
  comment_count bigint
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
    (select count(*) from public.post_comments c where c.post_id = p.id) as comment_count
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
  is_pinned boolean
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
    (owner.pinned_post_id = p.id) as is_pinned
  from public.posts p
  join public.profiles owner on owner.id = p_user
  left join public.profiles author on author.id = p.user_id
  where p.user_id = p_user
  order by (owner.pinned_post_id = p.id) desc, p.created_at desc
  limit 100;
$$;

drop function if exists public.list_post_comments(uuid);

create or replace function public.list_post_comments(p_post uuid)
returns table (
  id uuid,
  post_id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  created_at timestamptz,
  reactions jsonb
)
language sql security definer set search_path = public stable as $$
  select
    c.id, c.post_id, c.user_id, c.author_name,
    coalesce(pr.avatar_type, 'frog') as avatar_type,
    pr.avatar_url as avatar_url,
    c.body, c.created_at,
    public.comment_reactions_json(c.id) as reactions
  from public.post_comments c
  left join public.profiles pr on pr.id = c.user_id
  where c.post_id = p_post
  order by c.created_at asc
  limit 200;
$$;

grant execute on function public.list_feed_posts() to authenticated;
grant execute on function public.list_posts() to authenticated;
grant execute on function public.list_posts_by_user(uuid) to authenticated;
grant execute on function public.list_post_comments(uuid) to authenticated;

notify pgrst, 'reload schema';
