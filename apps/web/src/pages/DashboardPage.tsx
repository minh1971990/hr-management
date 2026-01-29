import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Candidate, CandidateStatus, Job } from '@hr-management/shared';
import { supabase } from '../lib/supabase';
import { CandidateList } from '../components/CandidateList';
import { AddCandidateForm, type AddCandidateFormValues } from '../components/AddCandidateForm';
import { AddJobForm, type AddJobFormValues } from '../components/AddJobForm';
import { CandidateFilters, type CandidateFiltersValue } from '../components/CandidateFilters';
import './DashboardPage.css';

export function DashboardPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [adding, setAdding] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [addingJob, setAddingJob] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        .select('id,user_id,full_name,applied_position,status,resume_url,created_at,updated_at')
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

      const { data: newRow, error: insertError } = await supabase
        .from('candidates')
        .insert({
          user_id: userId,
          full_name: values.full_name,
          applied_position: selectedJob.title,
          status: values.status,
          resume_url: resumeUrl,
        })
        .select('id,user_id,full_name,applied_position,status,resume_url,created_at,updated_at')
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }
      setCandidates((prev) => [newRow as Candidate, ...prev]);
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
      setJobs((prev) => [newJob as Job, ...prev]);
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
        .select('id,user_id,full_name,applied_position,status,resume_url,created_at,updated_at')
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
        .select('id,user_id,full_name,applied_position,status,resume_url,created_at,updated_at')
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
      </main>
    </div>
  );
}
