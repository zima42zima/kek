-- STEP 1 of 2: Echo browse columns
-- Open THIS FILE in Cursor, select all, copy, paste into Supabase SQL Editor, Run.
-- Do NOT copy from chat (chat adds "[4 lines collapsed]" garbage).

alter table public.echoes add column if not exists place_label text;

alter table public.echoes add column if not exists browse_globally boolean not null default false;

create index if not exists echoes_browse_globally_idx
  on public.echoes (browse_globally, visibility);
