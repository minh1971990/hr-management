-- Enable Realtime for candidates table so all online users get live updates
-- when someone adds, updates, or deletes a candidate
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;
