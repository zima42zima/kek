-- LEGACY — do not run. Superseded by supabase-patch-echo-anon-v2.sql.
-- Drop echo anonymity: everyone shows as themselves.
-- Safe to re-run. Clears flags + stops list RPC redaction.

update public.echoes
set anonymous = false
where anonymous = true;

-- Always return the real author (ignore p_anonymous).
create or replace function public.echo_public_author_name(p_owner uuid, p_anonymous boolean, p_name text)
returns text
language sql
stable
as $$
  select coalesce(nullif(trim(p_name), ''), 'a fren');
$$;

create or replace function public.echo_public_avatar_type(p_owner uuid, p_anonymous boolean, p_type text)
returns text
language sql
stable
as $$
  select coalesce(nullif(trim(p_type), ''), 'frog');
$$;

create or replace function public.echo_public_avatar_url(p_owner uuid, p_anonymous boolean, p_url text)
returns text
language sql
stable
as $$
  select p_url;
$$;

notify pgrst, 'reload schema';
