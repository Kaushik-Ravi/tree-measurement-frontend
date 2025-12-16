-- Add species_detail_image_url to tree_results table
ALTER TABLE public.tree_results
ADD COLUMN IF NOT EXISTS species_detail_image_url text;
