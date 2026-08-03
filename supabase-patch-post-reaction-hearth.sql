-- Allow the hearth post reaction alongside fire and thunder.
-- Safe to re-run. Run in Supabase → SQL Editor after supabase-patch-post-reactions.sql.

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
  if rid not in ('fire', 'thunder', 'hearth', 'lol') then raise exception 'Invalid reaction'; end if;

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

grant execute on function public.toggle_post_reaction(uuid, text) to authenticated;
