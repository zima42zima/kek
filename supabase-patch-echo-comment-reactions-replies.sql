-- Echo comment reactions + replies (parent_id).
-- Mirrors post_comment_reactions and cave message replies.
-- Safe to re-run. Run after supabase-patch-echo-comments.sql.

alter table public.echo_comments
  add column if not exists parent_id uuid references public.echo_comments(id) on delete set null;

create index if not exists echo_comments_parent_idx
  on public.echo_comments (parent_id)
  where parent_id is not null;

create table if not exists public.echo_comment_reactions (
  comment_id uuid references public.echo_comments(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  primary key (comment_id, user_id)
);

grant all on public.echo_comment_reactions to postgres, service_role;
grant select, insert, update, delete on public.echo_comment_reactions to authenticated;
alter table public.echo_comment_reactions enable row level security;

drop policy if exists "Echo comment reactions readable" on public.echo_comment_reactions;
create policy "Echo comment reactions readable"
  on public.echo_comment_reactions for select to authenticated using (true);

drop policy if exists "Users add echo comment reactions" on public.echo_comment_reactions;
create policy "Users add echo comment reactions"
  on public.echo_comment_reactions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update echo comment reactions" on public.echo_comment_reactions;
create policy "Users update echo comment reactions"
  on public.echo_comment_reactions for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users delete echo comment reactions" on public.echo_comment_reactions;
create policy "Users delete echo comment reactions"
  on public.echo_comment_reactions for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists echo_comment_reactions_comment_idx
  on public.echo_comment_reactions (comment_id);

create or replace function public.echo_comment_reactions_json(p_comment_id uuid)
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
        from public.echo_comment_reactions r
        where r.comment_id = p_comment_id
        group by r.emoji
      ) agg
    ),
    '[]'::jsonb
  );
$$;

create or replace function public.toggle_echo_comment_reaction(
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
    select 1 from public.echo_comments c where c.id = p_comment
  ) then
    raise exception 'Comment not found';
  end if;

  if exists (
    select 1 from public.echo_comment_reactions
    where comment_id = p_comment and user_id = uid and emoji = em
  ) then
    delete from public.echo_comment_reactions
    where comment_id = p_comment and user_id = uid and emoji = em;
  elsif exists (
    select 1 from public.echo_comment_reactions
    where comment_id = p_comment and user_id = uid
  ) then
    update public.echo_comment_reactions
    set emoji = em, created_at = now()
    where comment_id = p_comment and user_id = uid;
  else
    insert into public.echo_comment_reactions (comment_id, user_id, emoji)
    values (p_comment, uid, em);
  end if;

  return public.echo_comment_reactions_json(p_comment);
end;
$$;

drop function if exists public.list_echo_comments(uuid);
create or replace function public.list_echo_comments(p_echo uuid)
returns table (
  id uuid,
  echo_id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  created_at timestamptz,
  parent_id uuid,
  reply_author_name text,
  reply_body text,
  reactions jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    c.echo_id,
    c.user_id,
    coalesce(pr.silly_name, c.author_name, 'a fren') as author_name,
    coalesce(pr.avatar_type, 'frog') as avatar_type,
    pr.avatar_url as avatar_url,
    c.body,
    c.created_at,
    c.parent_id,
    case
      when c.parent_id is null then null
      else coalesce(ppr.silly_name, parent.author_name, 'a fren')
    end as reply_author_name,
    case
      when c.parent_id is null then null
      else left(parent.body, 120)
    end as reply_body,
    public.echo_comment_reactions_json(c.id) as reactions
  from public.echo_comments c
  join public.echoes e on e.id = c.echo_id
  left join public.profiles pr on pr.id = c.user_id
  left join public.echo_comments parent on parent.id = c.parent_id
  left join public.profiles ppr on ppr.id = parent.user_id
  where c.echo_id = p_echo
    and e.hidden = false
    and (e.expires_at is null or e.expires_at > now())
    and (
      e.owner_id = auth.uid()
      or e.visibility = 'world'
      or e.visibility = 'friends'
    )
  order by c.created_at asc
  limit 200;
$$;

drop function if exists public.add_echo_comment(uuid, text, text, text, text);
create or replace function public.add_echo_comment(
  p_echo uuid,
  p_body text,
  p_author_name text default null,
  p_avatar_type text default 'frog',
  p_avatar_url text default null,
  p_parent_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  echo_row public.echoes%rowtype;
  parent_row public.echo_comments%rowtype;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(p_body), '') is null then raise exception 'Comment cannot be empty'; end if;

  select * into echo_row from public.echoes where id = p_echo;
  if not found then raise exception 'Echo not found'; end if;
  if echo_row.hidden then raise exception 'Echo not found'; end if;
  if echo_row.expires_at is not null and echo_row.expires_at <= now() then
    raise exception 'Echo expired';
  end if;
  if not coalesce(echo_row.allow_comments, false) then
    raise exception 'Comments are off for this echo';
  end if;
  if echo_row.visibility = 'private' and echo_row.owner_id <> uid then
    raise exception 'Not allowed';
  end if;

  if p_parent_id is not null then
    select * into parent_row from public.echo_comments where id = p_parent_id;
    if not found or parent_row.echo_id <> p_echo then
      raise exception 'Parent comment not found';
    end if;
  end if;

  insert into public.echo_comments (
    echo_id, user_id, author_name, avatar_type, avatar_url, body, parent_id
  )
  values (
    p_echo,
    uid,
    p_author_name,
    coalesce(p_avatar_type, 'frog'),
    p_avatar_url,
    trim(p_body),
    p_parent_id
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.echo_comment_reactions_json(uuid) to authenticated;
grant execute on function public.toggle_echo_comment_reaction(uuid, text) to authenticated;
grant execute on function public.list_echo_comments(uuid) to authenticated;
grant execute on function public.add_echo_comment(uuid, text, text, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';
