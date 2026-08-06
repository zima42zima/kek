-- Aura on echo comments (same idea as post/echo aura).
-- Run after supabase-patch-echo-comment-reactions-replies.sql.
-- Safe to re-run.

create table if not exists public.echo_comment_aura (
  comment_id uuid references public.echo_comments(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  primary key (comment_id, user_id)
);

grant select, insert, delete on public.echo_comment_aura to authenticated;
alter table public.echo_comment_aura enable row level security;

drop policy if exists "Echo comment aura readable" on public.echo_comment_aura;
create policy "Echo comment aura readable"
  on public.echo_comment_aura for select to authenticated using (true);

drop policy if exists "Users give echo comment aura" on public.echo_comment_aura;
create policy "Users give echo comment aura"
  on public.echo_comment_aura for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users remove echo comment aura" on public.echo_comment_aura;
create policy "Users remove echo comment aura"
  on public.echo_comment_aura for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists echo_comment_aura_comment_idx
  on public.echo_comment_aura (comment_id);

create or replace function public.toggle_echo_comment_aura(p_comment uuid)
returns table (aura_count bigint, i_gave_aura boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  had boolean;
  author uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select c.user_id into author from public.echo_comments c where c.id = p_comment;
  if author is null then raise exception 'Comment not found'; end if;
  if author = uid then raise exception 'Cannot aura your own comment'; end if;

  select exists (
    select 1 from public.echo_comment_aura where comment_id = p_comment and user_id = uid
  ) into had;

  if had then
    delete from public.echo_comment_aura where comment_id = p_comment and user_id = uid;
  else
    insert into public.echo_comment_aura (comment_id, user_id)
    values (p_comment, uid)
    on conflict do nothing;
  end if;

  return query
    select
      (select count(*) from public.echo_comment_aura where comment_id = p_comment),
      (not had);
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
  reactions jsonb,
  aura_count bigint,
  i_gave_aura boolean
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
    public.echo_comment_reactions_json(c.id) as reactions,
    (select count(*) from public.echo_comment_aura a where a.comment_id = c.id) as aura_count,
    exists (
      select 1 from public.echo_comment_aura a
      where a.comment_id = c.id and a.user_id = auth.uid()
    ) as i_gave_aura
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

grant execute on function public.toggle_echo_comment_aura(uuid) to authenticated;
grant execute on function public.list_echo_comments(uuid) to authenticated;

notify pgrst, 'reload schema';
