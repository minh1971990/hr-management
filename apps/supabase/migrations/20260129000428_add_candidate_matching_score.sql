-- Add fields for AI matching score workflow
-- - skills: extracted skills from resume (JSON array)
-- - matching_score: (matching skills / required skills) * 100

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS skills jsonb,
  ADD COLUMN IF NOT EXISTS matching_score numeric;

COMMENT ON COLUMN public.candidates.skills IS 'Extracted skills from resume (JSON array of strings)';
COMMENT ON COLUMN public.candidates.matching_score IS 'Matching score percentage (0-100)';
