import { useState } from 'react';
import type { CandidateStatus, Job } from '@hr-management/shared';
import './AddCandidateForm.css';

const DEFAULT_STATUS: CandidateStatus = 'New';

export interface AddCandidateFormValues {
  full_name: string;
  job_id: string;
  status: CandidateStatus;
  resume_file: File | null;
}

interface AddCandidateFormProps {
  jobs: Job[];
  onSubmit: (values: AddCandidateFormValues) => void | Promise<void>;
  loading?: boolean;
}

export function AddCandidateForm({ jobs, onSubmit, loading }: AddCandidateFormProps) {
  const [fullName, setFullName] = useState('');
  const [jobId, setJobId] = useState('');
  const [status, setStatus] = useState<CandidateStatus>(DEFAULT_STATUS);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [fileLabel, setFileLabel] = useState('No file chosen');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResumeFile(file);
      setFileLabel(file.name);
    } else {
      setResumeFile(null);
      setFileLabel('No file chosen');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile) return;
    if (!jobId) return;
    await onSubmit({
      full_name: fullName.trim(),
      job_id: jobId,
      status,
      resume_file: resumeFile,
    });
    setFullName('');
    setJobId('');
    setStatus(DEFAULT_STATUS);
    setResumeFile(null);
    setFileLabel('No file chosen');
    // Reset file input
    const input = document.getElementById('resume-upload') as HTMLInputElement;
    if (input) input.value = '';
  };

  return (
    <form className="add-candidate-form" onSubmit={handleSubmit}>
      <h3 className="form-heading">Add new candidate</h3>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="full_name">Full name</label>
          <input
            id="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="job_id">Applied position</label>
          <select
            id="job_id"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            required
            disabled={jobs.length === 0}
          >
            <option value="" disabled>
              {jobs.length === 0 ? 'Add a job first' : 'Select a job'}
            </option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="initial_status">Initial status</label>
          <select
            id="initial_status"
            value={status}
            onChange={(e) => setStatus(e.target.value as CandidateStatus)}
          >
            <option value="New">New</option>
            <option value="Interviewing">Interviewing</option>
            <option value="Hired">Hired</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        <div className="form-group form-group-file">
          <label htmlFor="resume-upload">CV / Resume (PDF) <span className="required">*</span></label>
          <div className="file-input-wrap">
            <input
              id="resume-upload"
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="file-input"
              aria-label="Upload resume (required)"
              required
            />
            <span className="file-label">{fileLabel}</span>
          </div>
        </div>
      </div>
      <button type="submit" className="submit-btn" disabled={loading}>
        {loading ? 'Adding...' : 'Add candidate'}
      </button>
    </form>
  );
}
