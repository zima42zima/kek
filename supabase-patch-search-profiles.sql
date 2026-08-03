-- People search: find any account by handle or display name.
-- SECURITY DEFINER so search works even if profiles RLS is tighter than expected.
-- Safe to re-run.

alter table public.profiles add column if not exists fren_handle text;

create or replace function public.search_profiles(
  p_query text,
  p_limit int default 20
)
returns table (
  id uuid,
  handle text,
  name text,
  avatar_type text,
  avatar_url text,
  bio text
)
language sql
security definer
set search_path = public
stable
as $$
  with q as (
    select nullif(trim(both from lower(coalesce(p_query, ''))), '') as needle
  ),
  lim as (
    select greatest(1, least(coalesce(p_limit, 20), 50)) as n
  )
  select
    pr.id,
    nullif(trim(pr.fren_handle), '') as handle,
    coalesce(nullif(trim(pr.silly_name), ''), 'a fren') as name,
    coalesce(pr.avatar_type, 'frog') as avatar_type,
    pr.avatar_url,
    pr.bio
  from public.profiles pr, q, lim
  where q.needle is not null
    and (
      lower(trim(coalesce(pr.fren_handle, ''))) like '%' || q.needle || '%'
      or lower(trim(coalesce(pr.silly_name, ''))) like '%' || q.needle || '%'
    )
    -- Prefer others; still return self if they are the only match
  order by
    case when pr.id = auth.uid() then 1 else 0 end,
    case
      when lower(trim(coalesce(pr.fren_handle, ''))) = q.needle then 0
      when lower(trim(coalesce(pr.silly_name, ''))) = q.needle then 1
      when lower(trim(coalesce(pr.fren_handle, ''))) like q.needle || '%' then 2
      when lower(trim(coalesce(pr.silly_name, ''))) like q.needle || '%' then 3
      else 4
    end,
    pr.silly_name nulls last
  limit (select n from lim);
$$;

-- Lock from public/anon (Postgres often grants EXECUTE to PUBLIC by default).
revoke execute on function public.search_profiles(text, int) from public;
revoke execute on function public.search_profiles(text, int) from anon;
grant execute on function public.search_profiles(text, int) to authenticated;

comment on function public.search_profiles(text, int) is
  'Case-insensitive people search by fren_handle or silly_name (authenticated only).';
