-- Show to frens: human curation for the home feed.
-- Safe to re-run. Run after supabase-fix-profile-permissions.sql (+ comment_count list_posts if applied).

create table if not exists public.post_shows (
  user_id uuid references auth.users on delete cascade not null,
  post_id uuid references public.posts on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (user_id, post_id)
);

grant select, insert, delete on public.post_shows to authenticated;
alter table public.post_shows enable row level security;

drop policy if exists "Post shows are viewable by authenticated users" on public.post_shows;
create policy "Post shows are viewable by authenticated users"
  on public.post_shows for select to authenticated using (true);

drop policy if exists "Users manage their own post shows" on public.post_shows;
create policy "Users manage their own post shows"
  on public.post_shows for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users remove their own post shows" on public.post_shows;
create policy "Users remove their own post shows"
  on public.post_shows for delete to authenticated using (auth.uid() = user_id);

create index if not exists post_shows_user_created_idx
  on public.post_shows (user_id, created_at desc);

create index if not exists post_shows_post_idx
  on public.post_shows (post_id);

-- Toggle show for a post. Returns whether the viewer is now showing it.
create or replace function public.toggle_show_to_frens(p_post uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  post_owner uuid;
  post_audience text;
  already_showing boolean;
  daily_count int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select p.user_id, p.audience
  into post_owner, post_audience
  from public.posts p
  where p.id = p_post;

  if post_owner is null then
    raise exception 'Post not found';
  end if;

  if post_owner = uid then
    raise exception 'Cannot show your own post';
  end if;

  if post_audience not in ('everyone', 'frens') then
    raise exception 'This post cannot be shown to frens';
  end if;

  if post_audience = 'frens' and not exists (
    select 1 from public.follows f
    where f.follower_id = uid and f.following_id = post_owner
  ) then
    raise exception 'You cannot show this post';
  end if;

  select exists (
    select 1 from public.post_shows s
    where s.user_id = uid and s.post_id = p_post
  ) into already_showing;

  if already_showing then
    delete from public.post_shows
    where user_id = uid and post_id = p_post;
    return false;
  end if;

  select count(*) into daily_count
  from public.post_shows s
  where s.user_id = uid
    and s.created_at > now() - interval '1 day';

  if daily_count >= 10 then
    raise exception 'Show limit reached (10 per day)';
  end if;

  insert into public.post_shows (user_id, post_id) values (uid, p_post);
  return true;
end;
$$;

-- Home feed: your posts + followed authors + posts frens showed you.
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
      coalesce(pr.silly_name, 'a fren'),
      s.created_at
    from public.post_shows s
    join public.follows f
      on f.following_id = s.user_id and f.follower_id = auth.uid()
    join public.posts p on p.id = s.post_id
    left join public.profiles pr on pr.id = s.user_id
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
    p.avatar_type,
    p.avatar_url,
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
  order by r.sort_at desc
  limit 200;
$$;

grant execute on function public.toggle_show_to_frens(uuid) to authenticated;
grant execute on function public.list_feed_posts() to authenticated;
