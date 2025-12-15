-- Enable PostGIS if available (optional, but good practice)
-- create extension if not exists postgis;

-- CAMPAIGNS
create table if not exists public.campaigns (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  status text default 'draft' check (status in ('draft', 'active', 'archived')),
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz default now()
);

-- SQUADS
create table if not exists public.squads (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  join_code text unique not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- SQUAD MEMBERS
create table if not exists public.squad_members (
  id uuid default gen_random_uuid() primary key,
  squad_id uuid references public.squads(id) on delete cascade,
  user_id uuid references auth.users(id),
  role text default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz default now(),
  unique(squad_id, user_id)
);

-- STREET SEGMENTS
create table if not exists public.street_segments (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  name text,
  geometry jsonb not null, -- GeoJSON LineString
  length_meters float,
  status text default 'available' check (status in ('available', 'locked', 'completed', 'validated')),
  locked_by_user uuid references auth.users(id),
  locked_by_squad uuid references public.squads(id),
  locked_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- RLS POLICIES
alter table public.campaigns enable row level security;
create policy "Campaigns are viewable by everyone" on public.campaigns for select using (true);

alter table public.squads enable row level security;
create policy "Squads are viewable by everyone" on public.squads for select using (true);
create policy "Authenticated users can create squads" on public.squads for insert with check (auth.uid() = created_by);

alter table public.squad_members enable row level security;
create policy "Squad members viewable by everyone" on public.squad_members for select using (true);
create policy "Users can join squads" on public.squad_members for insert with check (auth.uid() = user_id);

alter table public.street_segments enable row level security;
create policy "Segments are viewable by everyone" on public.street_segments for select using (true);
create policy "Authenticated users can update segments" on public.street_segments for update using (auth.role() = 'authenticated');
