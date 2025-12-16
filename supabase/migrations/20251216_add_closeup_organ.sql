-- Add species_detail_organ to tree_results table
ALTER TABLE public.tree_results
ADD COLUMN IF NOT EXISTS species_detail_organ text;
