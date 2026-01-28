-- Create storage bucket for resumes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'resumes',
    'resumes',
    false, -- Private bucket - users can only access their own files
    52428800, -- 50MB file size limit
    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] -- PDF, DOC, DOCX
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload files to their own folder
CREATE POLICY "Users can upload their own resumes"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'resumes' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy: Users can view their own resumes
CREATE POLICY "Users can view their own resumes"
    ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'resumes' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy: Users can update their own resumes
CREATE POLICY "Users can update their own resumes"
    ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'resumes' AND
        auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
        bucket_id = 'resumes' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy: Users can delete their own resumes
CREATE POLICY "Users can delete their own resumes"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'resumes' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

