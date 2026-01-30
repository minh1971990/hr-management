// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CandidateStatus = 'New' | 'Interviewing' | 'Hired' | 'Rejected';

function isValidUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function isValidHttpUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'Missing Authorization header' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return json(500, { error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: 'Unauthorized' });
  const userId = userData.user.id;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const full_name = String(payload?.full_name ?? '').trim();
  const job_id = String(payload?.job_id ?? '').trim();
  const status = String(payload?.status ?? 'New').trim() as CandidateStatus;
  const resume_url = String(payload?.resume_url ?? '').trim();

  const allowedStatuses: CandidateStatus[] = ['New', 'Interviewing', 'Hired', 'Rejected'];
  if (!full_name) return json(400, { error: 'full_name is required' });
  if (full_name.length > 200) return json(400, { error: 'full_name is too long' });
  if (!job_id) return json(400, { error: 'job_id is required' });
  if (!isValidUuid(job_id)) return json(400, { error: 'job_id must be a UUID' });
  if (!allowedStatuses.includes(status)) return json(400, { error: 'status is invalid' });
  if (!resume_url) return json(400, { error: 'resume_url is required' });
  if (!isValidHttpUrl(resume_url)) return json(400, { error: 'resume_url must be a valid http(s) URL' });

  // Ensure the job exists and map to applied_position title
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id,title')
    .eq('id', job_id)
    .single();
  if (jobErr) return json(400, { error: jobErr.message });
  if (!job) return json(400, { error: 'Job not found' });

  const { data: newRow, error: insertErr } = await supabase
    .from('candidates')
    .insert({
      user_id: userId,
      full_name,
      applied_position: job.title,
      status,
      resume_url,
    })
    .select('id,user_id,full_name,applied_position,status,resume_url,matching_score,recommendation,reasoning,created_at,updated_at')
    .single();

  if (insertErr) return json(400, { error: insertErr.message });

  // Fire-and-forget webhook to n8n for downstream automation (e.g. matching score)
  const webhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
  const webhookSecret = Deno.env.get('N8N_WEBHOOK_SECRET');
  if (webhookUrl && webhookSecret) {
    void fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': webhookSecret,
      },
      body: JSON.stringify({
        candidate_id: newRow?.id,
        job_id,
        resume_url,
      }),
    }).catch(() => {
      // don't block candidate creation if webhook fails
    });
  }

  return json(201, { candidate: newRow });
});

