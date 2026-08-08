-- Hide a DM thread from your inbox (does not delete for the other fren).
-- Reappears if a newer message arrives, or if you open the chat again.
-- Safe to re-run.

alter table public.dm_read_state
  add column if not exists hidden_at timestamptz;

create or replace function public.hide_dm_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_conversation_id is null then raise exception 'Conversation required'; end if;
  if not exists (
    select 1 from public.dm_conversations c
    where c.id = p_conversation_id
      and (c.user_a = uid or c.user_b = uid)
  ) then
    raise exception 'Not a participant';
  end if;

  insert into public.dm_read_state (conversation_id, user_id, last_read_at, hidden_at)
  values (p_conversation_id, uid, now(), now())
  on conflict (conversation_id, user_id) do update
    set hidden_at = now();
end;
$$;

grant execute on function public.hide_dm_conversation(uuid) to authenticated;

-- Drop from your list while hidden_at is set and nothing newer has arrived.
create or replace function public.list_my_dm_threads()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_name text,
  other_avatar_type text,
  other_avatar_url text,
  last_body text,
  last_image text,
  last_video text,
  last_sticker text,
  last_at timestamptz,
  unread_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id as conversation_id,
    case when c.user_a = auth.uid() then c.user_b else c.user_a end as other_user_id,
    coalesce(pr.silly_name, 'a fren') as other_name,
    coalesce(pr.avatar_type, 'frog') as other_avatar_type,
    pr.avatar_url as other_avatar_url,
    lm.body as last_body,
    lm.image as last_image,
    lm.video as last_video,
    lm.sticker as last_sticker,
    coalesce(lm.created_at, c.updated_at) as last_at,
    (
      select count(*)
      from public.dm_messages m
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(
          (select rs.last_read_at from public.dm_read_state rs
           where rs.conversation_id = c.id and rs.user_id = auth.uid()),
          '1970-01-01'::timestamptz
        )
    ) as unread_count
  from public.dm_conversations c
  left join public.profiles pr on pr.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  left join lateral (
    select m.body, m.image, m.video, m.sticker, m.created_at
    from public.dm_messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  left join public.dm_read_state mine
    on mine.conversation_id = c.id and mine.user_id = auth.uid()
  where (c.user_a = auth.uid() or c.user_b = auth.uid())
    and (
      mine.hidden_at is null
      or coalesce(lm.created_at, c.updated_at) > mine.hidden_at
    )
  order by coalesce(lm.created_at, c.updated_at) desc;
$$;

grant execute on function public.list_my_dm_threads() to authenticated;

-- Opening a chat again un-hides it for you.
create or replace function public.get_or_create_dm(p_target uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a uuid;
  b uuid;
  cid uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  begin
    perform public.assert_active_user();
  exception when undefined_function then
    null;
  end;
  if p_target is null or p_target = uid then raise exception 'Invalid target'; end if;

  a := least(uid, p_target);
  b := greatest(uid, p_target);

  select id into cid from public.dm_conversations where user_a = a and user_b = b;
  if cid is null then
    insert into public.dm_conversations (user_a, user_b) values (a, b) returning id into cid;
    insert into public.dm_read_state (conversation_id, user_id, last_read_at)
    values (cid, uid, now()), (cid, p_target, now())
    on conflict do nothing;
  else
    insert into public.dm_read_state (conversation_id, user_id, last_read_at, hidden_at)
    values (cid, uid, now(), null)
    on conflict (conversation_id, user_id) do update
      set hidden_at = null;
  end if;

  return cid;
end;
$$;

grant execute on function public.get_or_create_dm(uuid) to authenticated;

-- Opening a thread clears hide for you.
create or replace function public.mark_dm_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.dm_read_state (conversation_id, user_id, last_read_at, hidden_at)
  values (p_conversation_id, uid, now(), null)
  on conflict (conversation_id, user_id) do update
    set last_read_at = now(),
        hidden_at = null;
end;
$$;

grant execute on function public.mark_dm_conversation_read(uuid) to authenticated;

notify pgrst, 'reload schema';
