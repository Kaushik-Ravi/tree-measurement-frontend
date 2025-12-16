-- 1. Create Assignments Table
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id uuid REFERENCES public.squads(id),
  segment_id uuid REFERENCES public.street_segments(id),
  assignee_id uuid REFERENCES auth.users(id),
  assigned_by uuid REFERENCES auth.users(id),
  priority text DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'critical')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'blocked', 'completed')),
  due_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Squad members can view assignments"
  ON public.assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = assignments.squad_id
      AND squad_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Leaders can manage assignments"
  ON public.assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = assignments.squad_id
      AND squad_members.user_id = auth.uid()
      AND squad_members.role = 'leader'
    )
  );

-- 2. Update Bulk Assignment Function to use the new table
CREATE OR REPLACE FUNCTION public.bulk_assign_segments(
  segment_ids uuid[],
  squad_id uuid,
  assignee_id uuid,
  priority text DEFAULT 'normal'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  seg_id uuid;
BEGIN
  -- Loop through segments to create assignment records
  FOREACH seg_id IN ARRAY segment_ids
  LOOP
    INSERT INTO public.assignments (squad_id, segment_id, assignee_id, assigned_by, priority, status)
    VALUES (squad_id, seg_id, assignee_id, auth.uid(), priority, 'pending');
  END LOOP;

  -- Update the segments to be locked by the squad and user (Visual status)
  UPDATE public.street_segments
  SET 
    status = 'locked',
    locked_by_squad = squad_id,
    locked_by_user = assignee_id,
    locked_at = now(),
    priority = bulk_assign_segments.priority
  WHERE id = ANY(segment_ids)
  AND status = 'available';
END;
$$;
