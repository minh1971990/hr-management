-- Allow any authenticated HR user to delete any candidate (shared list)
-- so the X button actually removes the row for everyone
CREATE POLICY "Authenticated users can delete any candidate"
    ON public.candidates
    FOR DELETE
    TO authenticated
    USING (true);
