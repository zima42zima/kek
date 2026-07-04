-- Run this in Supabase SQL Editor before using the app.

create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  silly_name text not null,
  one_human_thing text,
  favorite_fail text,
  current_vibe text,
  created_at timestamp with time zone default now()
);

create table if not exists invites (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  created_by uuid references auth.users on delete set null,
  used_by uuid references auth.users on delete set null,
  created_at timestamp with time zone default now(),
  used_at timestamp with time zone
);

alter table profiles enable row level security;
alter table invites enable row level security;

create policy "Profiles are viewable by authenticated users"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Invites are viewable by authenticated users"
  on invites for select
  using (auth.role() = 'authenticated');

create policy "Users can create invites"
  on invites for insert
  with check (auth.uid() = created_by);

create policy "Anyone authenticated can mark an invite used"
  on invites for update
  using (auth.role() = 'authenticated');
