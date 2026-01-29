import type { Candidate, CandidateStatus } from '@hr-management/shared';
import './CandidateList.css';

const STATUS_OPTIONS: CandidateStatus[] = ['New', 'Interviewing', 'Hired', 'Rejected'];

interface CandidateListProps {
  candidates: Candidate[];
  onStatusChange?: (candidateId: string, newStatus: CandidateStatus) => void;
  onDelete?: (candidateId: string) => void | Promise<void>;
  onViewResume?: (resumeUrl: string) => void | Promise<void>;
  loading?: boolean;
}

export function CandidateList({ candidates, onStatusChange, onDelete, onViewResume, loading }: CandidateListProps) {
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
    </div>
  );
}
