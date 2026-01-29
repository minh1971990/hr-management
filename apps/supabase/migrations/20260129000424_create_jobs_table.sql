-- Create jobs table (job title + description) for HR to manage
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate job titles
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_title_unique ON public.jobs(title);

-- Enable Row Level Security
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view/manage jobs (shared HR list)
CREATE POLICY "Authenticated users can view all jobs"
    ON public.jobs
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert jobs"
    ON public.jobs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update jobs"
    ON public.jobs
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete jobs"
    ON public.jobs
    FOR DELETE
    TO authenticated
    USING (true);

-- Reuse the existing updated_at trigger function from candidates migration
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.jobs IS 'Stores job title and description for candidate applied_position dropdown';
