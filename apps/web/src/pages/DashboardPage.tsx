import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Candidate, CandidateStatus } from '@hr-management/shared';
import { supabase } from '../lib/supabase';
import { CandidateList } from '../components/CandidateList';
import { AddCandidateForm, type AddCandidateFormValues } from '../components/AddCandidateForm';
import './DashboardPage.css';

export function DashboardPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        .select('*')
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

  const handleAddCandidate = async (_values: AddCandidateFormValues) => {
    setAdding(true);
    try {
      // TODO: 1) Upload file to Supabase Storage, 2) Call Edge Function or insert into candidates table
      // Then load candidates from Supabase (or use Realtime to update list)
      await Promise.resolve();
    } finally {
      setAdding(false);
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
      const { data } = await supabase.from('candidates').select('*').order('created_at', { ascending: false });
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
        <AddCandidateForm onSubmit={handleAddCandidate} loading={adding} />
        <section className="candidates-section">
          <h2 className="section-title">All candidates</h2>
          <CandidateList
            candidates={candidates}
            onStatusChange={handleStatusChange}
            loading={loadingList}
          />
        </section>
      </main>
    </div>
  );
}
