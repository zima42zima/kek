-- Per-user post list with aura state (for profiles + aura anywhere).
-- Safe to re-run. Run in Supabase → SQL Editor.

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
  where p.user_id = p_user
  order by p.created_at desc
  limit 100;
$$;

grant execute on function public.list_posts_by_user(uuid) to authenticated;

notify pgrst, 'reload schema';
