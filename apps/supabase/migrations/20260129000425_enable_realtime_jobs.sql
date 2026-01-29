-- Enable Realtime for jobs table so dropdown updates for all users
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
