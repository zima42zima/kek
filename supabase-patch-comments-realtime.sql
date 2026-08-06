-- Live comment feeds: echo_comments + post_comments on supabase_realtime.
-- Required so open echoes / home threads pick up inserts & deletes without refresh.

alter table public.echo_comments replica identity full;
alter table public.post_comments replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.echo_comments;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.post_comments;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
