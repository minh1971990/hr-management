import { useMemo, useState } from 'react';
import type { Candidate, CandidateStatus } from '@hr-management/shared';
import './CandidateList.css';

const STATUS_OPTIONS: CandidateStatus[] = ['New', 'Interviewing', 'Hired', 'Rejected'];

type MatchBucket =
  | 'strong_match'
  | 'good_match'
  | 'moderate_match'
  | 'weak_match'
  | 'not_recommended';

function getMatchMeta(score: number): { bucket: MatchBucket; label: string; description: string } {
  const s = Math.max(0, Math.min(100, score));

  if (s >= 80) {
    return {
      bucket: 'strong_match',
      label: 'Excellent fit',
      description: 'Excellent fit, highly recommend',
    };
  }
  if (s >= 65) {
    return {
      bucket: 'good_match',
      label: 'Good fit',
      description: 'Good fit, recommend interview',
    };
  }
  if (s >= 50) {
    return {
      bucket: 'moderate_match',
      label: 'Acceptable fit',
      description: 'Acceptable fit, consider interview',
    };
  }
  if (s >= 35) {
    return {
      bucket: 'weak_match',
      label: 'Poor fit',
      description: 'Poor fit, only if desperate',
    };
  }
  return {
    bucket: 'not_recommended',
    label: 'Not suitable',
    description: 'Not suitable for this role',
  };
}

interface CandidateListProps {
  candidates: Candidate[];
  onStatusChange?: (candidateId: string, newStatus: CandidateStatus) => void;
  onDelete?: (candidateId: string) => void | Promise<void>;
  onViewResume?: (resumeUrl: string) => void | Promise<void>;
  loading?: boolean;
}

export function CandidateList({ candidates, onStatusChange, onDelete, onViewResume, loading }: CandidateListProps) {
  const [detailsCandidateId, setDetailsCandidateId] = useState<string | null>(null);

  const detailsCandidate = useMemo(() => {
    if (!detailsCandidateId) return null;
    return candidates.find((c) => c.id === detailsCandidateId) ?? null;
  }, [candidates, detailsCandidateId]);

  if (loading) {
    return (
      <div className="candidate-list-loading">
        <p>Loading candidates...</p>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="candidate-list-empty">
        <p>No candidates yet. Add your first candidate using the form above.</p>
      </div>
    );
  }

  return (
    <div className="candidate-list-wrap">
      <table className="candidate-table">
        <thead>
          <tr>
            <th>Full name</th>
            <th>Applied position</th>
            <th>Status</th>
            <th>Match score</th>
            <th>Created at</th>
            <th>CV / Resume</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id}>
              <td className="cell-name">{c.full_name}</td>
              <td>{c.applied_position}</td>
              <td>
                <span className={`status-badge status-${c.status.toLowerCase()}`}>
                  {c.status}
                </span>
              </td>
              <td className="cell-score">
                {typeof c.matching_score === 'number' ? (
                  (() => {
                    const meta = getMatchMeta(c.matching_score);
                    const pct = Math.round(c.matching_score * 100) / 100;
                    return (
                      <div className="match-wrap" title={meta.description}>
                        <div className="match-row">
                          <span className={`match-pill ${meta.bucket}`}>{pct}%</span>
                          <button
                            type="button"
                            className="match-more"
                            onClick={() => setDetailsCandidateId(c.id)}
                          >
                            View more
                          </button>
                        </div>
                        <span className="match-label">{meta.label}</span>
                      </div>
                    );
                  })()
                ) : (
                  '—'
                )}
              </td>
              <td className="cell-date">
                {c.created_at ? new Date(c.created_at).toLocaleString() : '—'}
              </td>
              <td>
                {c.resume_url ? (
                  c.resume_url.startsWith('http') ? (
                    <a
                      href={c.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cv-link"
                    >
                      View CV
                    </a>
                  ) : onViewResume ? (
                    <button
                      type="button"
                      className="cv-link cv-link-button"
                      onClick={() => onViewResume(c.resume_url!)}
                    >
                      View CV
                    </button>
                  ) : (
                    <a
                      href={c.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cv-link"
                    >
                      View CV
                    </a>
                  )
                ) : (
                  <span className="no-cv">—</span>
                )}
              </td>
              <td className="cell-actions">
                <select
                  className="status-select"
                  value={c.status}
                  onChange={(e) =>
                    onStatusChange?.(c.id, e.target.value as CandidateStatus)
                  }
                  aria-label={`Update status for ${c.full_name}`}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {onDelete && (
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => onDelete(c.id)}
                    aria-label={`Delete ${c.full_name}`}
                    title="Delete candidate"
                  >
                    ×
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {detailsCandidate && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailsCandidateId(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Candidate details</div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDetailsCandidateId(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-kv">
                <div className="modal-k">Name</div>
                <div className="modal-v">{detailsCandidate.full_name}</div>
              </div>
              <div className="modal-kv">
                <div className="modal-k">Position</div>
                <div className="modal-v">{detailsCandidate.applied_position}</div>
              </div>
              <div className="modal-kv">
                <div className="modal-k">Match score</div>
                <div className="modal-v">
                  {typeof detailsCandidate.matching_score === 'number'
                    ? `${Math.round(detailsCandidate.matching_score * 100) / 100}%`
                    : '—'}
                </div>
              </div>
              <hr className="modal-sep" />
              <div className="modal-kv">
                <div className="modal-k">Reasoning</div>
                <div className="modal-v pre">{detailsCandidate.reasoning ?? '—'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
