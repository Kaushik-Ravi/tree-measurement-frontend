-- 1. CAMPAIGNS TABLE
-- Stores the overarching events (e.g., "Pune Census 2025")
create table if not exists public.campaigns (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  status text default 'draft' check (status in ('draft', 'active', 'archived')),
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz default now()
);

-- 2. SQUADS TABLE
-- Groups of users working together
create table if not exists public.squads (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  code text unique not null, -- The 6-char join code
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- 3. SQUAD MEMBERS TABLE
-- Links users to squads
create table if not exists public.squad_members (
  id uuid default gen_random_uuid() primary key,
  squad_id uuid references public.squads(id) on delete cascade,
  user_id uuid references auth.users(id),
  role text default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz default now(),
  unique(squad_id, user_id) -- Prevent duplicate joining
);

-- 4. STREET SEGMENTS TABLE
-- The core "Tasks" for the mission
create table if not exists public.street_segments (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  name text,
  geometry jsonb not null, -- Stores the GeoJSON LineString
  length_meters float,
  status text default 'available' check (status in ('available', 'locked', 'completed', 'validated')),
  
  -- Locking mechanism
  locked_by_user uuid references auth.users(id),
  locked_by_squad uuid references public.squads(id),
  locked_at timestamptz,
  
  -- Completion info
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  
  created_at timestamptz default now()
);

-- 5. ENABLE ROW LEVEL SECURITY (RLS)
-- This ensures data safety as per your requirements
alter table public.campaigns enable row level security;
alter table public.squads enable row level security;
alter table public.squad_members enable row level security;
alter table public.street_segments enable row level security;

-- 6. RLS POLICIES (The Rules)

-- Campaigns: Everyone can view active campaigns
create policy "Campaigns are viewable by everyone" 
on public.campaigns for select using (true);

-- Squads: Everyone can view squads (to join them), Authenticated users can create
create policy "Squads are viewable by everyone" 
on public.squads for select using (true);

create policy "Authenticated users can create squads" 
on public.squads for insert with check (auth.uid() = created_by);

-- Squad Members: Viewable by everyone (to see team size), Users can join
create policy "Squad members viewable by everyone" 
on public.squad_members for select using (true);

create policy "Users can join squads" 
on public.squad_members for insert with check (auth.uid() = user_id);

-- Street Segments: Viewable by everyone, Updateable by logged-in users (to lock/complete)
create policy "Segments are viewable by everyone" 
on public.street_segments for select using (true);

create policy "Authenticated users can update segments" 
on public.street_segments for update using (auth.role() = 'authenticated');

-- Allow inserting segments (for the admin script to work via Service Role, or authenticated users if you run it locally)
create policy "Authenticated users can insert segments" 
on public.street_segments for insert with check (auth.role() = 'authenticated');
