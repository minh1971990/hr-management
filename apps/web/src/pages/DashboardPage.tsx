import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Candidate, CandidateStatus, Job } from '@hr-management/shared';
import { supabase } from '../lib/supabase';
import { CandidateList } from '../components/CandidateList';
import { AddCandidateForm, type AddCandidateFormValues } from '../components/AddCandidateForm';
import { AddJobForm, type AddJobFormValues } from '../components/AddJobForm';
import { CandidateFilters, type CandidateFiltersValue } from '../components/CandidateFilters';
import './DashboardPage.css';

type AnalyticsResponse = {
  total_candidates: number;
  status_breakdown: Array<{ status: string; count: number; percentage: number }>;
  top_positions: Array<{ applied_position: string; count: number }>;
  newest_last_7_days: Candidate[];
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [adding, setAdding] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [addingJob, setAddingJob] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [recommendJobTitle, setRecommendJobTitle] = useState<string | null>(null);

  const [filters, setFilters] = useState<CandidateFiltersValue>({
    query: '',
    position: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    sort: 'relevance',
  });

  useEffect(() => {
    async function loadCandidates() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }
      setLoadingList(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('candidates')
        .select('id,user_id,full_name,applied_position,status,resume_url,matching_score,recommendation,reasoning,created_at,updated_at')
        .order('created_at', { ascending: false });
      setLoadingList(false);
      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      setCandidates((data ?? []) as Candidate[]);
    }
    loadCandidates();
  }, [navigate]);

  useEffect(() => {
    async function loadJobs() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setLoadingJobs(true);
      const { data, error: fetchError } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });
      setLoadingJobs(false);
      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      setJobs((data ?? []) as Job[]);
    }
    loadJobs();
  }, []);

  const positionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const j of jobs) set.add(j.title);
    // Fallback for any legacy values in candidates table
    for (const c of candidates) if (c.applied_position) set.add(c.applied_position);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [jobs, candidates]);

  const statusOptions = useMemo(() => {
    // Keep a stable order matching CandidateStatus
    return ['New', 'Interviewing', 'Hired', 'Rejected'];
  }, []);

  function normalizeText(s: string) {
    const lowered = s.toLowerCase().trim();
    // Remove diacritics (helps with “near match”)
    return lowered.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function tokenize(s: string) {
    return normalizeText(s)
      .split(/[^a-z0-9]+/g)
      .filter(Boolean);
  }

  // Dice coefficient on bigrams – fast “fuzzy” similarity (0..1)
  function diceCoefficient(a: string, b: string) {
    const s1 = normalizeText(a);
    const s2 = normalizeText(b);
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1;
    if (s1.length < 2 || s2.length < 2) return 0;

    const bigrams = new Map<string, number>();
    for (let i = 0; i < s1.length - 1; i++) {
      const bg = s1.slice(i, i + 2);
      bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1);
    }
    let intersection = 0;
    for (let i = 0; i < s2.length - 1; i++) {
      const bg = s2.slice(i, i + 2);
      const count = bigrams.get(bg) ?? 0;
      if (count > 0) {
        bigrams.set(bg, count - 1);
        intersection++;
      }
    }
    return (2 * intersection) / ((s1.length - 1) + (s2.length - 1));
  }

  function computeMatchScore(query: string, candidate: Candidate) {
    const q = normalizeText(query);
    if (!q) return 0;
    const haystack = normalizeText(
      `${candidate.full_name} ${candidate.applied_position} ${candidate.status}`
    );

    // Hard match boosts
    let score = 0;
    if (haystack.includes(q)) score += 60;

    // Token overlap boosts
    const qTokens = tokenize(q);
    const hTokens = new Set(tokenize(haystack));
    let hits = 0;
    for (const t of qTokens) {
      if (!t) continue;
      if (hTokens.has(t)) hits += 1;
      else if (haystack.includes(t)) hits += 0.5;
    }
    score += Math.min(30, hits * 10);

    // Fuzzy similarity (0..1) => up to 40 points
    const dice = diceCoefficient(q, haystack);
    score += Math.round(dice * 40);

    return Math.max(0, Math.min(100, score));
  }

  const filteredCandidates = useMemo(() => {
    const query = filters.query.trim();
    const hasQuery = query.length > 0;

    const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`) : null;

    const withScores = candidates
      .map((c) => {
        const score = hasQuery ? computeMatchScore(query, c) : 0;
        return { c, score };
      })
      .filter(({ c, score }) => {
        if (filters.status && c.status !== filters.status) return false;
        if (filters.position && c.applied_position !== filters.position) return false;
        const created = new Date(c.created_at);
        if (from && created < from) return false;
        if (to && created > to) return false;
        if (hasQuery && score <= 0) return false;
        return true;
      });

    withScores.sort((a, b) => {
      if (filters.sort === 'relevance') {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.c.created_at).getTime() - new Date(a.c.created_at).getTime();
      }
      if (filters.sort === 'newest') {
        return new Date(b.c.created_at).getTime() - new Date(a.c.created_at).getTime();
      }
      if (filters.sort === 'oldest') {
        return new Date(a.c.created_at).getTime() - new Date(b.c.created_at).getTime();
      }
      if (filters.sort === 'name_az') {
        return a.c.full_name.localeCompare(b.c.full_name);
      }
      if (filters.sort === 'name_za') {
        return b.c.full_name.localeCompare(a.c.full_name);
      }
      return 0;
    });

    return withScores.map(({ c }) => c);
  }, [candidates, filters]);

  const jobCandidateCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of candidates) {
      map.set(c.applied_position, (map.get(c.applied_position) ?? 0) + 1);
    }
    return map;
  }, [candidates]);

  const top3ForRecommendedJob = useMemo(() => {
    if (!recommendJobTitle) return [];
    return candidates
      .filter((c) => c.applied_position === recommendJobTitle)
      .slice()
      .sort((a, b) => {
        const as = typeof a.matching_score === 'number' ? a.matching_score : -1;
        const bs = typeof b.matching_score === 'number' ? b.matching_score : -1;
        if (bs !== as) return bs - as;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 3);
  }, [candidates, recommendJobTitle]);

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    setAnalyticsError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAnalyticsError('You must be signed in to view analytics.');
        return;
      }
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      const accessTokenRaw = refreshed?.session?.access_token ?? session.access_token;
      if (refreshErr || !accessTokenRaw) {
        setAnalyticsError('Your session is no longer valid. Please sign in again.');
        return;
      }
      const accessToken = accessTokenRaw.startsWith('Bearer ')
        ? accessTokenRaw.slice('Bearer '.length)
        : accessTokenRaw;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const resp = await fetch(`${supabaseUrl}/functions/v1/analytics`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
        },
      });
      const text = await resp.text();
      const parsed = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
      if (!resp.ok) {
        const msg =
          (parsed && typeof parsed === 'object' && (parsed as any).error)
            ? String((parsed as any).error)
            : text || 'Analytics function returned an error';
        setAnalyticsError(`${msg} (HTTP ${resp.status})`);
        return;
      }
      setAnalytics(parsed as AnalyticsResponse);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Realtime: when any user adds/updates/deletes a candidate, all online users' lists update
  useEffect(() => {
    const channel = supabase
      .channel('candidates-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'candidates',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as Candidate;
            setCandidates((prev) => [newRow, ...prev.filter((c) => c.id !== newRow.id)]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Candidate;
            setCandidates((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
            );
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setCandidates((prev) => prev.filter((c) => c.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Realtime: keep jobs dropdown updated for all users
  useEffect(() => {
    const channel = supabase
      .channel('jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newJob = payload.new as Job;
            setJobs((prev) => [newJob, ...prev.filter((j) => j.id !== newJob.id)]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Job;
            setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setJobs((prev) => prev.filter((j) => j.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddCandidate = async (values: AddCandidateFormValues) => {
    setAdding(true);
    setError(null);
    try {
      if (!values.resume_file) {
        setError('CV / Resume file is required. Please upload a PDF.');
        setAdding(false);
        return;
      }
      const selectedJob = jobs.find((j) => j.id === values.job_id);
      if (!selectedJob) {
        setError('Please select a valid job.');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setError('You must be signed in to add a candidate.');
        return;
      }
      const userId = session.user.id;
      // Ensure we use a fresh JWT (prevents Invalid JWT errors)
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      const accessTokenRaw = refreshed?.session?.access_token ?? session.access_token;
      if (refreshErr || !accessTokenRaw) {
        setError('Your session is no longer valid. Please sign in again.');
        await supabase.auth.signOut();
        navigate('/login', { replace: true });
        return;
      }
      const accessToken = accessTokenRaw.startsWith('Bearer ')
        ? accessTokenRaw.slice('Bearer '.length)
        : accessTokenRaw;
      if (accessToken.split('.').length !== 3) {
        setError('Invalid auth token format. Please sign in again.');
        await supabase.auth.signOut();
        navigate('/login', { replace: true });
        return;
      }

      const ext = values.resume_file.name.split('.').pop() ?? 'pdf';
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(path, values.resume_file, { upsert: false });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      const { data: publicUrlData } = supabase.storage.from('resumes').getPublicUrl(path);
      const resumeUrl = publicUrlData.publicUrl;

      // Use a direct fetch so we fully control auth/apikey headers (avoids opaque 401s)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const resp = await fetch(`${supabaseUrl}/functions/v1/add-candidate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: values.full_name,
          job_id: values.job_id,
          status: values.status,
          resume_url: resumeUrl,
        }),
      });

      const bodyText = await resp.text();
      const parsed = bodyText ? (() => { try { return JSON.parse(bodyText); } catch { return null; } })() : null;
      if (!resp.ok) {
        const msg = (parsed && typeof parsed === 'object' && (parsed as any).error)
          ? String((parsed as any).error)
          : bodyText || 'Edge Function returned an error';
        setError(`${msg} (HTTP ${resp.status})`);
        return;
      }

      const newRow = (parsed as any)?.candidate as Candidate | undefined;
      // Realtime INSERT may arrive before this response; de-dupe by id
      if (newRow) setCandidates((prev) => [newRow, ...prev.filter((c) => c.id !== newRow.id)]);
    } finally {
      setAdding(false);
    }
  };

  const handleAddJob = async (values: AddJobFormValues) => {
    setAddingJob(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('You must be signed in to add a job.');
        return;
      }
      const { data: newJob, error: insertError } = await supabase
        .from('jobs')
        .insert({
          title: values.title,
          description: values.description,
        })
        .select('*')
        .single();
      if (insertError) {
        setError(insertError.message);
        return;
      }
      // Realtime INSERT may arrive before this response; de-dupe by id
      setJobs((prev) => [newJob as Job, ...prev.filter((j) => j.id !== (newJob as Job).id)]);
    } finally {
      setAddingJob(false);
    }
  };

  const handleStatusChange = async (candidateId: string, newStatus: CandidateStatus) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, status: newStatus, updated_at: new Date().toISOString() } : c))
    );
    const { error: updateError } = await supabase
      .from('candidates')
      .update({ status: newStatus })
      .eq('id', candidateId);
    if (updateError) {
      setError(updateError.message);
      const { data } = await supabase
        .from('candidates')
        .select('id,user_id,full_name,applied_position,status,resume_url,matching_score,recommendation,reasoning,created_at,updated_at')
        .order('created_at', { ascending: false });
      setCandidates((data ?? []) as Candidate[]);
    }
  };

  const handleDelete = async (candidateId: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
    const { data: deleted, error: deleteError } = await supabase
      .from('candidates')
      .delete()
      .eq('id', candidateId)
      .select('id');
    if (deleteError || !deleted?.length) {
      setError(deleteError?.message ?? 'Failed to delete candidate. You can only delete candidates you added.');
      const { data } = await supabase
        .from('candidates')
        .select('id,user_id,full_name,applied_position,status,resume_url,matching_score,recommendation,reasoning,created_at,updated_at')
        .order('created_at', { ascending: false });
      setCandidates((data ?? []) as Candidate[]);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Candidate dashboard</h1>
        <button type="button" className="header-signout" onClick={handleSignOut}>
          Sign out
        </button>
      </header>

      <main className="dashboard-main">
        {error && (
          <div className="dashboard-error" role="alert">
            {error}
          </div>
        )}
        <AddJobForm onSubmit={handleAddJob} loading={addingJob} />
        <section className="jobs-section">
          <h2 className="section-title">Jobs</h2>
          <div className="jobs-table-wrap">
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>Job title</th>
                  <th>Candidates</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="jobs-empty">
                      {loadingJobs ? 'Loading jobs…' : 'No jobs yet. Add one above.'}
                    </td>
                  </tr>
                ) : (
                  jobs.map((j) => {
                    const count = jobCandidateCounts.get(j.title) ?? 0;
                    return (
                      <tr key={j.id}>
                        <td className="jobs-title">{j.title}</td>
                        <td className="jobs-count">{loadingList ? '…' : count}</td>
                        <td>
                          <button
                            type="button"
                            className="jobs-recommend"
                            onClick={() => setRecommendJobTitle(j.title)}
                            disabled={loadingList}
                          >
                            Top 3 candidates
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
        <AddCandidateForm jobs={jobs} onSubmit={handleAddCandidate} loading={adding || loadingJobs} />
        <section className="candidates-section">
          <h2 className="section-title">All candidates</h2>
          <CandidateFilters
            value={filters}
            onChange={setFilters}
            onReset={() =>
              setFilters({
                query: '',
                position: '',
                status: '',
                dateFrom: '',
                dateTo: '',
                sort: 'relevance',
              })
            }
            positionOptions={positionOptions}
            statusOptions={statusOptions}
            resultsCount={filteredCandidates.length}
            totalCount={candidates.length}
          />
          <div className="analytics-panel">
            <div className="analytics-header">
              <h3 className="analytics-title">Analytics</h3>
              <button type="button" className="analytics-refresh" onClick={loadAnalytics} disabled={loadingAnalytics}>
                {loadingAnalytics ? 'Loading…' : 'Refresh'}
              </button>
            </div>
            {analyticsError && (
              <div className="analytics-error" role="alert">
                {analyticsError}
              </div>
            )}
            {analytics && (
              <div className="analytics-grid">
                <div className="analytics-card">
                  <div className="analytics-label">Total candidates</div>
                  <div className="analytics-value">{analytics.total_candidates}</div>
                </div>
                <div className="analytics-card">
                  <div className="analytics-label">Status breakdown</div>
                  <ul className="analytics-list">
                    {analytics.status_breakdown.map((s) => (
                      <li key={s.status}>
                        <strong>{s.status}</strong>: {s.count} ({s.percentage}%)
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="analytics-card">
                  <div className="analytics-label">Top positions</div>
                  <ul className="analytics-list">
                    {analytics.top_positions.map((p) => (
                      <li key={p.applied_position}>
                        <strong>{p.applied_position}</strong>: {p.count}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="analytics-card">
                  <div className="analytics-label">Newest last 7 days</div>
                  <div className="analytics-value">{analytics.newest_last_7_days.length}</div>
                </div>
              </div>
            )}
          </div>
          <CandidateList
            candidates={filteredCandidates}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onViewResume={async (resumeUrl) => {
              if (resumeUrl.startsWith('http')) {
                window.open(resumeUrl, '_blank');
                return;
              }
              const { data } = await supabase.storage.from('resumes').createSignedUrl(resumeUrl, 60);
              if (data?.signedUrl) window.open(data.signedUrl, '_blank');
            }}
            loading={loadingList}
          />
        </section>

        {recommendJobTitle && (
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            onClick={() => setRecommendJobTitle(null)}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">Top 3 candidates for: {recommendJobTitle}</div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setRecommendJobTitle(null)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                {top3ForRecommendedJob.length === 0 ? (
                  <div className="modal-v">No candidates found for this job yet.</div>
                ) : (
                  <ol className="jobs-top3">
                    {top3ForRecommendedJob.map((c) => (
                      <li key={c.id} className="jobs-top3-item">
                        <div className="jobs-top3-name">{c.full_name}</div>
                        <div className="jobs-top3-meta">
                          <span className="jobs-top3-score">
                            {typeof c.matching_score === 'number'
                              ? `${Math.round(c.matching_score * 100) / 100}%`
                              : '—'}
                          </span>
                          <span className="jobs-top3-dot">•</span>
                          <span>{c.status}</span>
                          <span className="jobs-top3-dot">•</span>
                          <span>{c.created_at ? new Date(c.created_at).toLocaleString() : '—'}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
