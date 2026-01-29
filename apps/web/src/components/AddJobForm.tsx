import { useState } from 'react';
import './AddJobForm.css';

export interface AddJobFormValues {
  title: string;
  description: string;
}

interface AddJobFormProps {
  onSubmit: (values: AddJobFormValues) => void | Promise<void>;
  loading?: boolean;
}

export function AddJobForm({ onSubmit, loading }: AddJobFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ title: title.trim(), description: description.trim() });
    setTitle('');
    setDescription('');
  };

  return (
    <form className="add-job-form" onSubmit={handleSubmit}>
      <h3 className="form-heading">Add job</h3>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="job_title">Job title</label>
          <input
            id="job_title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Frontend Developer"
            required
          />
        </div>
      </div>
      <div className="form-row single">
        <div className="form-group">
          <label htmlFor="job_description">Job description</label>
          <textarea
            id="job_description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe responsibilities, requirements, etc."
            required
            rows={4}
          />
        </div>
      </div>
      <button type="submit" className="submit-btn" disabled={loading}>
        {loading ? 'Saving...' : 'Save job'}
      </button>
    </form>
  );
}

