-- Staff investigation PART 2/2 — DM messages + reports + grants
-- Run after part 1. Safe to re-run.

create or replace function public.staff_list_dm_messages(p_conversation_id uuid)
returns table (
  id bigint,
  sender_id uuid,
  author_name text,
  body text,
  image text,
  video text,
  sticker text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $fn$
begin
  if not public.am_i_platform_staff() then
    raise exception 'Staff only';
  end if;
  if p_conversation_id is null then
    raise exception 'No conversation';
  end if;

  return query
  select
    m.id,
    m.sender_id,
    m.author_name,
    m.body,
    m.image,
    m.video,
    m.sticker,
    m.created_at
  from public.dm_messages m
  where m.conversation_id = p_conversation_id
  order by m.created_at asc
  limit 500;
end;
$fn$;

create or replace function public.staff_list_user_reports(p_user uuid)
returns table (
  id uuid,
  kind text,
  ref_id text,
  preview text,
  reason text,
  status text,
  reporter_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $fn$
begin
  if not public.am_i_platform_staff() then
    raise exception 'Staff only';
  end if;

  return query
  select
    pr.id,
    pr.kind,
    pr.ref_id,
    pr.preview,
    pr.reason,
    pr.status,
    coalesce(rp.silly_name, 'a fren'),
    pr.created_at
  from public.platform_reports pr
  left join public.profiles rp on rp.id = pr.reporter_id
  where pr.reported_user_id = p_user
  order by pr.created_at desc
  limit 50;
end;
$fn$;

grant execute on function public.staff_get_user_dossier(uuid) to authenticated;
grant execute on function public.staff_list_user_posts(uuid, int) to authenticated;
grant execute on function public.staff_list_user_dm_threads(uuid) to authenticated;
grant execute on function public.staff_list_dm_messages(uuid) to authenticated;
grant execute on function public.staff_list_user_reports(uuid) to authenticated;

notify pgrst, 'reload schema';
