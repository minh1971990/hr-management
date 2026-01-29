-- Make resumes bucket public so we can store public URLs in resume_url
-- (Requirement: return a public URL to save in candidates.resume_url)
UPDATE storage.buckets
SET public = true
WHERE id = 'resumes';
