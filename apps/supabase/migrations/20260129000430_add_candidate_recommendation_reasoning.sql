-- Add AI recommendation fields to candidates
-- recommendation: short recommendation label (e.g. "Strong hire", "Consider", "No hire")
-- reasoning: free-text explanation

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS recommendation text,
  ADD COLUMN IF NOT EXISTS reasoning text;

COMMENT ON COLUMN public.candidates.recommendation IS 'AI recommendation label for the candidate';
COMMENT ON COLUMN public.candidates.reasoning IS 'AI reasoning/explanation for the recommendation';

