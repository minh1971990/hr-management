export type CandidateStatus = 'New' | 'Interviewing' | 'Hired' | 'Rejected';

export interface Candidate {
  id: string;
  user_id: string;
  full_name: string;
  applied_position: string;
  status: CandidateStatus;
  resume_url: string | null;
  matching_score?: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCandidateInput {
  full_name: string;
  applied_position: string;
  status?: CandidateStatus;
  resume_url?: string;
}

export interface UpdateCandidateInput {
  full_name?: string;
  applied_position?: string;
  status?: CandidateStatus;
  resume_url?: string;
}

