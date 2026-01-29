import './CandidateFilters.css';

export type CandidateSortMode = 'relevance' | 'newest' | 'oldest' | 'name_az' | 'name_za';

export interface CandidateFiltersValue {
  query: string;
  status: string; // '' means All
  position: string; // '' means All
  dateFrom: string; // yyyy-mm-dd or ''
  dateTo: string; // yyyy-mm-dd or ''
  sort: CandidateSortMode;
}

interface CandidateFiltersProps {
  value: CandidateFiltersValue;
  positionOptions: string[];
  statusOptions: string[];
  onChange: (next: CandidateFiltersValue) => void;
  onReset: () => void;
  resultsCount: number;
  totalCount: number;
}

export function CandidateFilters({
  value,
  positionOptions,
  statusOptions,
  onChange,
  onReset,
  resultsCount,
  totalCount,
}: CandidateFiltersProps) {
  return (
    <section className="candidate-filters">
      <div className="candidate-filters__header">
        <h3 className="candidate-filters__title">Search & filters</h3>
        <div className="candidate-filters__meta">
          <span className="candidate-filters__count">
            Showing <strong>{resultsCount}</strong> / {totalCount}
          </span>
          <button type="button" className="candidate-filters__reset" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>

      <div className="candidate-filters__grid">
        <div className="candidate-filters__field wide">
          <label htmlFor="candidate_query">Keyword</label>
          <input
            id="candidate_query"
            type="text"
            value={value.query}
            onChange={(e) => onChange({ ...value, query: e.target.value })}
            placeholder="Search name, position, status…"
          />
        </div>

        <div className="candidate-filters__field">
          <label htmlFor="candidate_position">Position</label>
          <select
            id="candidate_position"
            value={value.position}
            onChange={(e) => onChange({ ...value, position: e.target.value })}
          >
            <option value="">All positions</option>
            {positionOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="candidate-filters__field">
          <label htmlFor="candidate_status">Status</label>
          <select
            id="candidate_status"
            value={value.status}
            onChange={(e) => onChange({ ...value, status: e.target.value })}
          >
            <option value="">All statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="candidate-filters__field">
          <label htmlFor="candidate_from">Applied from</label>
          <input
            id="candidate_from"
            type="date"
            value={value.dateFrom}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
          />
        </div>

        <div className="candidate-filters__field">
          <label htmlFor="candidate_to">Applied to</label>
          <input
            id="candidate_to"
            type="date"
            value={value.dateTo}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
          />
        </div>

        <div className="candidate-filters__field">
          <label htmlFor="candidate_sort">Sort</label>
          <select
            id="candidate_sort"
            value={value.sort}
            onChange={(e) => onChange({ ...value, sort: e.target.value as CandidateSortMode })}
          >
            <option value="relevance">Smart (relevance)</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name_az">Name A → Z</option>
            <option value="name_za">Name Z → A</option>
          </select>
        </div>
      </div>
    </section>
  );
}

