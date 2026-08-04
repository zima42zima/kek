-- Echo comments — shared on public aftersounds.
-- Safe to re-run. Run after supabase-patch-echoes.sql (and image/browse patches).

create table if not exists public.echo_comments (
  id uuid primary key default gen_random_uuid(),
  echo_id uuid references public.echoes(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  author_name text,
  avatar_type text default 'frog',
  avatar_url text,
  body text not null,
  created_at timestamptz default now()
);

grant select, insert, delete on public.echo_comments to authenticated;

alter table public.echo_comments enable row level security;

drop policy if exists "Echo comments readable" on public.echo_comments;
create policy "Echo comments readable"
  on public.echo_comments for select to authenticated using (true);

drop policy if exists "Users add echo comments" on public.echo_comments;
create policy "Users add echo comments"
  on public.echo_comments for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own echo comments" on public.echo_comments;
create policy "Users delete own echo comments"
  on public.echo_comments for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists echo_comments_echo_idx
  on public.echo_comments (echo_id, created_at);

-- Anyone who can open the aftersound can read its comments.
create or replace function public.list_echo_comments(p_echo uuid)
returns table (
  id uuid,
  echo_id uuid,
  user_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.echo_id, c.user_id, c.author_name, c.avatar_type, c.avatar_url, c.body, c.created_at
  from public.echo_comments c
  join public.echoes e on e.id = c.echo_id
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

create or replace function public.add_echo_comment(
  p_echo uuid,
  p_body text,
  p_author_name text default null,
  p_avatar_type text default 'frog',
  p_avatar_url text default null
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
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(p_body), '') is null then raise exception 'Comment cannot be empty'; end if;

  select * into echo_row from public.echoes where id = p_echo;
  if not found then raise exception 'Aftersound not found'; end if;
  if echo_row.hidden then raise exception 'Aftersound not found'; end if;
  if echo_row.expires_at is not null and echo_row.expires_at <= now() then
    raise exception 'Aftersound expired';
  end if;
  if not coalesce(echo_row.allow_comments, false) then
    raise exception 'Comments are off for this aftersound';
  end if;
  if echo_row.visibility = 'private' and echo_row.owner_id <> uid then
    raise exception 'Not allowed';
  end if;

  insert into public.echo_comments (echo_id, user_id, author_name, avatar_type, avatar_url, body)
  values (
    p_echo,
    uid,
    p_author_name,
    coalesce(p_avatar_type, 'frog'),
    p_avatar_url,
    trim(p_body)
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.delete_echo_comment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.echo_comments
  where id = p_id
    and (
      user_id = uid
      or exists (
        select 1 from public.echoes e
        where e.id = echo_comments.echo_id and e.owner_id = uid
      )
    );
end;
$$;

grant execute on function public.list_echo_comments(uuid) to authenticated;
grant execute on function public.add_echo_comment(uuid, text, text, text, text) to authenticated;
grant execute on function public.delete_echo_comment(uuid) to authenticated;
