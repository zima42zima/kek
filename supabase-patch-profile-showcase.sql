-- Opt-in profile hub visibility (caves, echoes, playlists, moodboards, folds).
-- Default empty / false = nothing shown on public profile.

alter table public.profiles
  add column if not exists profile_showcase jsonb default '{}'::jsonb;

comment on column public.profiles.profile_showcase is
  'Opt-in map: { caves, echoes, playlists, moodboards, folds } booleans. Missing keys = false.';

-- Allow owners to update their own showcase (RLS already typically allows profile update by id = auth.uid()).
-- If your policies are restrictive, ensure profiles update includes profile_showcase for auth.uid() = id.
