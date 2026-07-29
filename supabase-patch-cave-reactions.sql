-- Run in Supabase → SQL Editor to add emoji reactions on cave messages.
-- Safe to re-run.

create table if not exists public.cave_message_reactions (
  message_id bigint references public.cave_messages(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  primary key (message_id, user_id, emoji)
);

grant all on public.cave_message_reactions to postgres, service_role;
grant select, insert, delete on public.cave_message_reactions to authenticated;
alter table public.cave_message_reactions enable row level security;

drop policy if exists "Cave reactions are viewable by authenticated users" on public.cave_message_reactions;
create policy "Cave reactions are viewable by authenticated users"
  on public.cave_message_reactions for select to authenticated using (true);

drop policy if exists "Users add their own cave reactions" on public.cave_message_reactions;
create policy "Users add their own cave reactions"
  on public.cave_message_reactions for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users remove their own cave reactions" on public.cave_message_reactions;
create policy "Users remove their own cave reactions"
  on public.cave_message_reactions for delete to authenticated using (auth.uid() = user_id);

create index if not exists cave_message_reactions_msg_idx on public.cave_message_reactions (message_id);

create or replace function public.cave_message_reactions_json(p_message_id bigint)
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
        from public.cave_message_reactions r
        where r.message_id = p_message_id
        group by r.emoji
      ) agg
    ),
    '[]'::jsonb
  );
$$;

create or replace function public.toggle_cave_message_reaction(
  p_message_id bigint,
  p_cave_id text,
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
    select 1 from public.cave_members cm
    where cm.cave_id = p_cave_id and cm.user_id = uid
  ) then
    raise exception 'Not a cave member';
  end if;

  if not exists (
    select 1 from public.cave_messages m
    where m.id = p_message_id and m.cave_id = p_cave_id
  ) then
    raise exception 'Message not found';
  end if;

  if exists (
    select 1 from public.cave_message_reactions
    where message_id = p_message_id and user_id = uid and emoji = em
  ) then
    delete from public.cave_message_reactions
    where message_id = p_message_id and user_id = uid and emoji = em;
  else
    insert into public.cave_message_reactions (message_id, user_id, emoji)
    values (p_message_id, uid, em);
  end if;

  return public.cave_message_reactions_json(p_message_id);
end;
$$;

drop function if exists public.list_cave_messages(text);
create or replace function public.list_cave_messages(p_cave_id text)
returns table (
  id bigint,
  author_id uuid,
  author_name text,
  avatar_type text,
  avatar_url text,
  body text,
  image text,
  sticker text,
  created_at timestamptz,
  reactions jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select m.id, m.author_id, m.author_name, m.avatar_type, m.avatar_url,
         m.body, m.image, m.sticker, m.created_at,
         public.cave_message_reactions_json(m.id) as reactions
  from public.cave_messages m
  where m.cave_id = p_cave_id
    and exists (
      select 1 from public.cave_members cm
      where cm.cave_id = p_cave_id and cm.user_id = auth.uid()
    )
  order by m.created_at asc
  limit 500;
$$;

create or replace function public.list_my_caves()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
  result jsonb := '[]'::jsonb;
  cid text;
  cave_obj jsonb;
begin
  if uid is null then return '[]'::jsonb; end if;

  for cid in
    select cm.cave_id from public.cave_members cm where cm.user_id = uid
    order by (select c.updated_at from public.caves c where c.id = cm.cave_id) desc
  loop
    select jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'emoji', c.emoji,
      'ownerId', c.owner_id,
      'access', c.access,
      'banned', to_jsonb(coalesce(c.banned, '{}'::uuid[])),
      'emojiPacks', coalesce(c.emoji_packs, '[]'::jsonb),
      'hiddenOnProfile', coalesce(my.hidden_on_profile, false),
      'members', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', cm2.user_id,
          'name', coalesce(pr.silly_name, 'a fren'),
          'avatarType', coalesce(pr.avatar_type, 'frog'),
          'avatarUrl', pr.avatar_url,
          'role', cm2.role
        ) order by cm2.joined_at)
        from public.cave_members cm2
        left join public.profiles pr on pr.id = cm2.user_id
        where cm2.cave_id = c.id
      ), '[]'::jsonb),
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', m.id,
          'authorId', m.author_id,
          'authorName', m.author_name,
          'avatarType', m.avatar_type,
          'avatarUrl', m.avatar_url,
          'text', m.body,
          'image', m.image,
          'sticker', m.sticker,
          'reactions', public.cave_message_reactions_json(m.id),
          'ts', case
            when m.created_at > now() - interval '45 seconds' then 'just now'
            when m.created_at > now() - interval '1 hour' then floor(extract(epoch from (now() - m.created_at)) / 60)::text || 'm'
            when m.created_at > now() - interval '1 day' then floor(extract(epoch from (now() - m.created_at)) / 3600)::text || 'h'
            else to_char(m.created_at, 'Mon DD')
          end
        ) order by m.created_at)
        from public.cave_messages m
        where m.cave_id = c.id
      ), '[]'::jsonb)
    ) into cave_obj
    from public.caves c
    join public.cave_members my on my.cave_id = c.id and my.user_id = uid
    where c.id = cid;

    result := result || jsonb_build_array(cave_obj);
  end loop;

  return result;
end;
$$;

grant execute on function public.cave_message_reactions_json(bigint) to authenticated;
grant execute on function public.toggle_cave_message_reaction(bigint, text, text) to authenticated;
grant execute on function public.list_cave_messages(text) to authenticated;
grant execute on function public.list_my_caves() to authenticated;

notify pgrst, 'reload schema';
