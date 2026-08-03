-- Authors can permanently delete their own cave / DM messages.
-- Safe to re-run. Separate from moderator hide/pin tools.

-- ── Cave ───────────────────────────────────────────────────────────────────
create or replace function public.delete_cave_message(p_cave_id text, p_message_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.cave_members cm
    where cm.cave_id = p_cave_id and cm.user_id = uid
  ) then
    raise exception 'Not a member of this cave';
  end if;

  delete from public.cave_messages m
  where m.id = p_message_id
    and m.cave_id = p_cave_id
    and m.author_id = uid;

  if not found then
    raise exception 'Message not found or not yours';
  end if;
end;
$$;

grant execute on function public.delete_cave_message(text, bigint) to authenticated;

comment on function public.delete_cave_message(text, bigint) is
  'Author permanently deletes their own cave message.';

-- ── DM ─────────────────────────────────────────────────────────────────────
create or replace function public.delete_dm_message(p_conversation_id uuid, p_message_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.dm_conversations c
    where c.id = p_conversation_id
      and (c.user_a = uid or c.user_b = uid)
  ) then
    raise exception 'Not a participant';
  end if;

  delete from public.dm_messages m
  where m.id = p_message_id
    and m.conversation_id = p_conversation_id
    and m.sender_id = uid;

  if not found then
    raise exception 'Message not found or not yours';
  end if;
end;
$$;

grant execute on function public.delete_dm_message(uuid, bigint) to authenticated;

comment on function public.delete_dm_message(uuid, bigint) is
  'Sender permanently deletes their own DM message.';
