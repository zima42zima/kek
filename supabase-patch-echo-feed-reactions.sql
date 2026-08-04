-- Aftersound feed reactions (fire / thunder / hearth / lol) — same set as posts.
-- Separate from echo_reactions (aura). Safe to re-run.
-- Run after supabase-patch-echoes.sql / echo-aura.

create table if not exists public.echo_feed_reactions (
  echo_id uuid references public.echoes(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  reaction_id text not null,
  created_at timestamptz default now(),
  primary key (echo_id, user_id)
);

grant all on public.echo_feed_reactions to postgres, service_role;
grant select, insert, update, delete on public.echo_feed_reactions to authenticated;
alter table public.echo_feed_reactions enable row level security;

drop policy if exists "Echo feed reactions viewable" on public.echo_feed_reactions;
create policy "Echo feed reactions viewable"
  on public.echo_feed_reactions for select to authenticated using (true);

drop policy if exists "Users add own echo feed reactions" on public.echo_feed_reactions;
create policy "Users add own echo feed reactions"
  on public.echo_feed_reactions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own echo feed reactions" on public.echo_feed_reactions;
create policy "Users update own echo feed reactions"
  on public.echo_feed_reactions for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users remove own echo feed reactions" on public.echo_feed_reactions;
create policy "Users remove own echo feed reactions"
  on public.echo_feed_reactions for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists echo_feed_reactions_echo_idx
  on public.echo_feed_reactions (echo_id);

create or replace function public.echo_feed_reactions_json(p_echo_id uuid)
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
        from public.echo_feed_reactions r
        where r.echo_id = p_echo_id
        group by r.reaction_id
      ) agg
    ),
    '[]'::jsonb
  );
$$;

create or replace function public.toggle_echo_feed_reaction(
  p_echo uuid,
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
  echo_row public.echoes%rowtype;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if rid is null or rid = '' then raise exception 'Reaction required'; end if;
  if rid not in ('fire', 'thunder', 'hearth', 'lol') then raise exception 'Invalid reaction'; end if;

  select * into echo_row from public.echoes where id = p_echo;
  if not found then raise exception 'Aftersound not found'; end if;
  if echo_row.hidden then raise exception 'Aftersound not found'; end if;
  if echo_row.expires_at is not null and echo_row.expires_at <= now() then
    raise exception 'Aftersound expired';
  end if;
  if echo_row.visibility = 'private' and echo_row.owner_id <> uid then
    raise exception 'Not allowed';
  end if;

  if exists (
    select 1 from public.echo_feed_reactions
    where echo_id = p_echo and user_id = uid and reaction_id = rid
  ) then
    delete from public.echo_feed_reactions
    where echo_id = p_echo and user_id = uid and reaction_id = rid;
  elsif exists (
    select 1 from public.echo_feed_reactions
    where echo_id = p_echo and user_id = uid
  ) then
    update public.echo_feed_reactions
    set reaction_id = rid, created_at = now()
    where echo_id = p_echo and user_id = uid;
  else
    insert into public.echo_feed_reactions (echo_id, user_id, reaction_id)
    values (p_echo, uid, rid);
  end if;

  return public.echo_feed_reactions_json(p_echo);
end;
$$;

grant execute on function public.echo_feed_reactions_json(uuid) to authenticated;
grant execute on function public.toggle_echo_feed_reaction(uuid, text) to authenticated;
