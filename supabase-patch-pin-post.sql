-- Pin one post to the top of your profile.
-- Safe to re-run. Run in Supabase → SQL Editor.

alter table public.profiles
  add column if not exists pinned_post_id uuid references public.posts on delete set null;

create or replace function public.pin_profile_post(p_post uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.posts where id = p_post and user_id = uid
  ) then
    raise exception 'Post not found';
  end if;

  update public.profiles set pinned_post_id = p_post where id = uid;
end;
$$;

create or replace function public.unpin_profile_post()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  update public.profiles set pinned_post_id = null where id = uid;
end;
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
    (select count(*) from public.post_comments c where c.post_id = p.id) as comment_count,
    (pr.pinned_post_id = p.id) as is_pinned
  from public.posts p
  join public.profiles pr on pr.id = p_user
  where p.user_id = p_user
  order by (pr.pinned_post_id = p.id) desc, p.created_at desc
  limit 100;
$$;

grant execute on function public.pin_profile_post(uuid) to authenticated;
grant execute on function public.unpin_profile_post() to authenticated;
grant execute on function public.list_posts_by_user(uuid) to authenticated;

notify pgrst, 'reload schema';
