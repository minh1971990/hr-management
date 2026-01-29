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

  const handleAddCandidate = async (values: AddCandidateFormValues) => {
    setAdding(true);
    setError(null);
    try {
      if (!values.resume_file) {
        setError('CV / Resume file is required. Please upload a PDF.');
        setAdding(false);
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
          applied_position: values.applied_position,
          status: values.status,
          resume_url: resumeUrl,
        })
        .select('*')
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

  const handleDelete = async (candidateId: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
    const { data: deleted, error: deleteError } = await supabase
      .from('candidates')
      .delete()
      .eq('id', candidateId)
      .select('id');
    if (deleteError || !deleted?.length) {
      setError(deleteError?.message ?? 'Failed to delete candidate. You can only delete candidates you added.');
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
