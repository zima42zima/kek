-- Run in Supabase → SQL Editor to add emoji reactions on post comments.
-- Safe to re-run.

create table if not exists public.post_comment_reactions (
  comment_id uuid references public.post_comments(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  primary key (comment_id, user_id)
);

grant all on public.post_comment_reactions to postgres, service_role;
grant select, insert, update, delete on public.post_comment_reactions to authenticated;
alter table public.post_comment_reactions enable row level security;

drop policy if exists "Comment reactions are viewable by authenticated users" on public.post_comment_reactions;
create policy "Comment reactions are viewable by authenticated users"
  on public.post_comment_reactions for select to authenticated using (true);

drop policy if exists "Users add their own comment reactions" on public.post_comment_reactions;
create policy "Users add their own comment reactions"
  on public.post_comment_reactions for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users update their own comment reactions" on public.post_comment_reactions;
create policy "Users update their own comment reactions"
  on public.post_comment_reactions for update to authenticated using (auth.uid() = user_id);

drop policy if exists "Users remove their own comment reactions" on public.post_comment_reactions;
create policy "Users remove their own comment reactions"
  on public.post_comment_reactions for delete to authenticated using (auth.uid() = user_id);

create index if not exists post_comment_reactions_comment_idx on public.post_comment_reactions (comment_id);

create or replace function public.comment_reactions_json(p_comment_id uuid)
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
        from public.post_comment_reactions r
        where r.comment_id = p_comment_id
        group by r.emoji
      ) agg
    ),
    '[]'::jsonb
  );
$$;

create or replace function public.toggle_comment_reaction(
  p_comment uuid,
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
    select 1 from public.post_comments c where c.id = p_comment
  ) then
    raise exception 'Comment not found';
  end if;

  if exists (
    select 1 from public.post_comment_reactions
    where comment_id = p_comment and user_id = uid and emoji = em
  ) then
    delete from public.post_comment_reactions
    where comment_id = p_comment and user_id = uid and emoji = em;
  elsif exists (
    select 1 from public.post_comment_reactions
    where comment_id = p_comment and user_id = uid
  ) then
    update public.post_comment_reactions
    set emoji = em, created_at = now()
    where comment_id = p_comment and user_id = uid;
  else
    insert into public.post_comment_reactions (comment_id, user_id, emoji)
    values (p_comment, uid, em);
  end if;

  return public.comment_reactions_json(p_comment);
end;
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
    c.id, c.post_id, c.user_id, c.author_name, c.avatar_type, c.avatar_url, c.body, c.created_at,
    public.comment_reactions_json(c.id) as reactions
  from public.post_comments c
  where c.post_id = p_post
  order by c.created_at asc
  limit 200;
$$;

grant execute on function public.comment_reactions_json(uuid) to authenticated;
grant execute on function public.toggle_comment_reaction(uuid, text) to authenticated;
grant execute on function public.list_post_comments(uuid) to authenticated;
