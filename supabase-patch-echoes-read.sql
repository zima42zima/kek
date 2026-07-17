-- Echo Map — allow playback of discovered echoes (signed URLs).
-- Safe to re-run. Run once in Supabase → SQL Editor if you already ran supabase-patch-echoes.sql.

drop policy if exists "Authenticated read echo media" on storage.objects;
create policy "Authenticated read echo media"
  on storage.objects for select to authenticated
  using (bucket_id = 'echo-media');

notify pgrst, 'reload schema';
