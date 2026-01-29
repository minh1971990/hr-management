-- Allow all authenticated HR users to view all candidates (shared list)
-- so when any user adds/updates/deletes, all online users' dashboards update in real time
CREATE POLICY "Authenticated users can view all candidates"
    ON public.candidates
    FOR SELECT
    TO authenticated
    USING (true);
