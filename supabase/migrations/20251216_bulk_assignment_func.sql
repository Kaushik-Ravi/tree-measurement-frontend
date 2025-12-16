-- Function to handle bulk assignment of segments
-- This allows a leader to select multiple streets and assign them to a user in one go.

create or replace function public.bulk_assign_segments(
  segment_ids uuid[],
  squad_id uuid,
  assignee_id uuid,
  priority text default 'normal'
)
returns void
language plpgsql
security definer
as $$
declare
  seg_id uuid;
begin
  -- Iterate through each segment ID and create an assignment
  foreach seg_id in array segment_ids
  loop
    -- Check if assignment already exists to avoid duplicates (optional, but good practice)
    -- For now, we'll just insert. The table structure allows multiple assignments per segment 
    -- (e.g. different squads working on it), but usually we might want to restrict it.
    
    insert into public.assignments (squad_id, segment_id, assignee_id, assigned_by, priority, status)
    values (squad_id, seg_id, assignee_id, auth.uid(), priority, 'pending');
    
    -- Update the street_segment status to 'assigned' so it shows up differently on the map
    update public.street_segments 
    set status = 'assigned' 
    where id = seg_id;
    
  end loop;
end;
$$;
