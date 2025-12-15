-- MAPPED TREES TABLE
-- Stores the live locations of trees tagged by users.
-- This is a lightweight table for the "Live Map" visualization.
-- Detailed data might still live in the main backend/API, but this allows real-time syncing.

create table if not exists public.mapped_trees (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  lat float not null,
  lng float not null,
  species_name text,
  height_m float,
  dbh_cm float,
  status text default 'verified', -- or 'pending'
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.mapped_trees enable row level security;

-- Policies
create policy "Everyone can view mapped trees"
on public.mapped_trees for select
using (true);

create policy "Authenticated users can insert mapped trees"
on public.mapped_trees for insert
with check (auth.role() = 'authenticated');

create policy "Users can update their own trees"
on public.mapped_trees for update
using (auth.uid() = user_id);

create policy "Users can delete their own trees"
on public.mapped_trees for delete
using (auth.uid() = user_id);
