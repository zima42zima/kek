-- Run in Supabase → SQL Editor to add emoji reactions on DM messages.
-- Safe to re-run.

create table if not exists public.dm_message_reactions (
  message_id bigint references public.dm_messages(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  primary key (message_id, user_id, emoji)
);

grant all on public.dm_message_reactions to postgres, service_role;
grant select, insert, delete on public.dm_message_reactions to authenticated;
alter table public.dm_message_reactions enable row level security;

drop policy if exists "DM reactions are viewable by participants" on public.dm_message_reactions;
create policy "DM reactions are viewable by participants"
  on public.dm_message_reactions for select to authenticated
  using (exists (
    select 1
    from public.dm_messages m
    join public.dm_conversations c on c.id = m.conversation_id
    where m.id = dm_message_reactions.message_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  ));

drop policy if exists "Users add their own dm reactions" on public.dm_message_reactions;
create policy "Users add their own dm reactions"
  on public.dm_message_reactions for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users remove their own dm reactions" on public.dm_message_reactions;
create policy "Users remove their own dm reactions"
  on public.dm_message_reactions for delete to authenticated using (auth.uid() = user_id);

create index if not exists dm_message_reactions_msg_idx on public.dm_message_reactions (message_id);

create or replace function public.dm_message_reactions_json(p_message_id bigint)
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
        from public.dm_message_reactions r
        where r.message_id = p_message_id
        group by r.emoji
      ) agg
    ),
    '[]'::jsonb
  );
$$;

create or replace function public.toggle_dm_message_reaction(
  p_message_id bigint,
  p_conversation_id uuid,
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
    select 1
    from public.dm_messages m
    join public.dm_conversations c on c.id = m.conversation_id
    where m.id = p_message_id
      and m.conversation_id = p_conversation_id
      and (c.user_a = uid or c.user_b = uid)
  ) then
    raise exception 'Message not found';
  end if;

  if exists (
    select 1 from public.dm_message_reactions
    where message_id = p_message_id and user_id = uid and emoji = em
  ) then
    delete from public.dm_message_reactions
    where message_id = p_message_id and user_id = uid and emoji = em;
  else
    insert into public.dm_message_reactions (message_id, user_id, emoji)
    values (p_message_id, uid, em);
  end if;

  return public.dm_message_reactions_json(p_message_id);
end;
$$;

drop function if exists public.list_dm_messages(uuid);
create or replace function public.list_dm_messages(p_conversation_id uuid)
returns table (
  id bigint,
  sender_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  image text,
  video text,
  sticker text,
  created_at timestamptz,
  reactions jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select m.id, m.sender_id, m.author_name, m.avatar_type, m.avatar_url,
         m.body, m.image, m.video, m.sticker, m.created_at,
         public.dm_message_reactions_json(m.id) as reactions
  from public.dm_messages m
  join public.dm_conversations c on c.id = m.conversation_id
  where m.conversation_id = p_conversation_id
    and (c.user_a = auth.uid() or c.user_b = auth.uid())
  order by m.created_at asc
  limit 500;
$$;

grant execute on function public.dm_message_reactions_json(bigint) to authenticated;
grant execute on function public.toggle_dm_message_reaction(bigint, uuid, text) to authenticated;
grant execute on function public.list_dm_messages(uuid) to authenticated;
