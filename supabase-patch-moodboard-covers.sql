-- Moodboard list covers: optional cover_item_id, else last-added image URL.
-- Safe to re-run. Run after supabase-patch-moodboards.sql.

alter table public.profile_moodboards
  add column if not exists cover_item_id uuid references public.profile_gallery_items (id) on delete set null;

create or replace function public.list_user_moodboards(p_user uuid)
returns table (
  id uuid,
  name text,
  is_public boolean,
  sort_order int,
  item_count bigint,
  created_at timestamptz,
  cover_url text,
  cover_item_id uuid
)
language sql
security definer
set search_path = public
stable
as $$
  select
    m.id,
    m.name,
    m.is_public,
    m.sort_order,
    count(g.id) as item_count,
    m.created_at,
    coalesce(
      (
        select c.image_url
        from public.profile_gallery_items c
        where c.id = m.cover_item_id
          and c.moodboard_id = m.id
        limit 1
      ),
      (
        select latest.image_url
        from public.profile_gallery_items latest
        where latest.moodboard_id = m.id
        order by latest.created_at desc nulls last, latest.sort_order desc
        limit 1
      )
    ) as cover_url,
    m.cover_item_id
  from public.profile_moodboards m
  left join public.profile_gallery_items g on g.moodboard_id = m.id
  where m.user_id = p_user
    and (m.user_id = auth.uid() or m.is_public = true)
  group by m.id
  order by m.sort_order asc, m.created_at asc
  limit 16;
$$;

grant execute on function public.list_user_moodboards(uuid) to authenticated;

create or replace function public.set_moodboard_cover(p_moodboard uuid, p_item uuid)
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
    select 1 from public.profile_moodboards m
    where m.id = p_moodboard and m.user_id = uid
  ) then
    raise exception 'Moodboard not found';
  end if;

  if p_item is not null and not exists (
    select 1 from public.profile_gallery_items g
    where g.id = p_item and g.moodboard_id = p_moodboard and g.user_id = uid
  ) then
    raise exception 'Cover item not on this moodboard';
  end if;

  update public.profile_moodboards
  set cover_item_id = p_item
  where id = p_moodboard and user_id = uid;
end;
$$;

grant execute on function public.set_moodboard_cover(uuid, uuid) to authenticated;

comment on function public.set_moodboard_cover(uuid, uuid) is
  'Set or clear (p_item null) which gallery item is the moodboard list cover.';
