-- 1. ASSIGNMENTS TABLE
-- Formalizes the "Work Order". Allows leaders to push tasks to specific users.
create table if not exists public.assignments (
  id uuid default gen_random_uuid() primary key,
  squad_id uuid references public.squads(id) on delete cascade,
  segment_id uuid references public.street_segments(id),
  assignee_id uuid references auth.users(id),
  assigned_by uuid references auth.users(id),
  priority text default 'normal' check (priority in ('normal', 'high', 'critical')),
  status text default 'pending' check (status in ('pending', 'in_progress', 'blocked', 'completed')),
  due_at timestamptz,
  created_at timestamptz default now()
);

-- 2. SQUAD CHAT TABLE
-- Contextual Chat. Messages can be linked to a specific street_segment_id.
create table if not exists public.squad_chat (
  id uuid default gen_random_uuid() primary key,
  squad_id uuid references public.squads(id) on delete cascade,
  sender_id uuid references auth.users(id),
  message text not null,
  related_segment_id uuid references public.street_segments(id), -- Optional: links chat to a street
  location_lat float, -- Optional: Geo-tag latitude
  location_lng float, -- Optional: Geo-tag longitude
  created_at timestamptz default now()
);

-- 3. NOTIFICATIONS TABLE
-- Centralized system for @mentions and assignment alerts.
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade, -- The recipient
  type text not null check (type in ('assignment', 'mention', 'alert')),
  payload jsonb, -- Flexible data (e.g., { "segment_id": "...", "message": "..." })
  is_read boolean default false,
  created_at timestamptz default now()
);

-- 4. USER LOCATIONS TABLE
-- Stores the LAST KNOWN location of a user. 
-- Real-time updates might happen via Broadcast, but this is for persistence/initial load.
create table if not exists public.user_locations (
  user_id uuid references auth.users(id) primary key,
  squad_id uuid references public.squads(id),
  lat float not null,
  lng float not null,
  last_updated timestamptz default now()
);

-- 5. ENABLE RLS
alter table public.assignments enable row level security;
alter table public.squad_chat enable row level security;
alter table public.notifications enable row level security;
alter table public.user_locations enable row level security;

-- 6. RLS POLICIES

-- Assignments:
-- View: Squad members can view assignments in their squad.
create policy "Squad members can view assignments"
on public.assignments for select
using (
  exists (
    select 1 from public.squad_members
    where squad_members.squad_id = assignments.squad_id
    and squad_members.user_id = auth.uid()
  )
);

-- Insert/Update: Only Squad Leaders (or the assignee for status updates) can modify.
-- For simplicity in this iteration: Authenticated users in the squad can create/update.
create policy "Squad members can manage assignments"
on public.assignments for all
using (
  exists (
    select 1 from public.squad_members
    where squad_members.squad_id = assignments.squad_id
    and squad_members.user_id = auth.uid()
  )
);

-- Squad Chat:
-- View: Squad members can view chat.
create policy "Squad members can view chat"
on public.squad_chat for select
using (
  exists (
    select 1 from public.squad_members
    where squad_members.squad_id = squad_chat.squad_id
    and squad_members.user_id = auth.uid()
  )
);

-- Insert: Squad members can send messages.
create policy "Squad members can send messages"
on public.squad_chat for insert
with check (
  exists (
    select 1 from public.squad_members
    where squad_members.squad_id = squad_chat.squad_id
    and squad_members.user_id = auth.uid()
  )
);

-- Notifications:
-- Users can only see their own notifications.
create policy "Users can view own notifications"
on public.notifications for select
using (auth.uid() = user_id);

create policy "System/Users can create notifications"
on public.notifications for insert
with check (true); -- Allow creation (usually triggered by triggers or other users)

create policy "Users can update own notifications"
on public.notifications for update
using (auth.uid() = user_id);

-- User Locations:
-- View: Squad members can see locations of other members in the same squad.
create policy "Squad members can view locations"
on public.user_locations for select
using (
  exists (
    select 1 from public.squad_members sm_viewer
    join public.squad_members sm_target on sm_viewer.squad_id = sm_target.squad_id
    where sm_viewer.user_id = auth.uid()
    and sm_target.user_id = user_locations.user_id
  )
);

-- Update: Users can only update their own location.
create policy "Users can update own location"
on public.user_locations for all
using (auth.uid() = user_id);
