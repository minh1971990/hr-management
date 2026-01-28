-- Create candidates table
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    applied_position TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Interviewing', 'Hired', 'Rejected')),
    resume_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON public.candidates(user_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_candidates_status ON public.candidates(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON public.candidates(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own candidates
CREATE POLICY "Users can view their own candidates"
    ON public.candidates
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can only insert their own candidates
CREATE POLICY "Users can insert their own candidates"
    ON public.candidates
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own candidates
CREATE POLICY "Users can update their own candidates"
    ON public.candidates
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own candidates
CREATE POLICY "Users can delete their own candidates"
    ON public.candidates
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_candidates_updated_at
    BEFORE UPDATE ON public.candidates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE public.candidates IS 'Stores candidate resumes and application information';
COMMENT ON COLUMN public.candidates.user_id IS 'Foreign key to auth.users - identifies which HR user manages this candidate';
COMMENT ON COLUMN public.candidates.status IS 'Current status of the candidate application';

