-- Add latitude and longitude columns for bounding box filtering
alter table public.street_segments add column if not exists lat float;
alter table public.street_segments add column if not exists lng float;

-- Create indices for faster querying
create index if not exists street_segments_lat_idx on public.street_segments(lat);
create index if not exists street_segments_lng_idx on public.street_segments(lng);
