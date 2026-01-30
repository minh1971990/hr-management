# HR Management — Candidate Tracking (React + Supabase)

Small web app for HR to manage candidate applications:
- Sign up / sign in (Supabase Auth)
- Manage jobs (title + description)
- Add candidates with required CV upload (Supabase Storage)
- Update candidate status
- Real-time updates across online users (Supabase Realtime)
- Advanced client-side filtering/search/sort (including “smart relevance”)
- Analytics Edge Function (`/analytics`)
- Candidate creation Edge Function (`/add-candidate`)
- Optional AI automation hook (n8n) to populate `matching_score` + `reasoning`

---

## Tech stack

- Frontend: **React 18 + TypeScript + Vite**
- Backend: **Supabase**
  - Auth (email/password)
  - Postgres (RLS policies)
  - Storage (resumes bucket)
  - Edge Functions (`add-candidate`, `analytics`)
  - Realtime (Postgres changes)
- Automation (optional): **n8n Cloud** (webhook triggered from Edge Function)

---

## Key features (what HR can test)

- **Auth**: register/login/logout
- **Jobs**: create jobs and view job list
- **Candidates**:
  - create candidate (requires CV upload)
  - view candidate list (includes created date, match score badge)
  - update status
  - delete candidate
  - “View more” shows AI reasoning (if available)
- **Recommendations**:
  - per-job “Top 3 candidates” based on `matching_score`
- **Realtime**:
  - candidate list updates without refresh when candidates are added/updated/deleted
- **Advanced search**:
  - keyword + status + position + date-range filters
  - smart sort and match-score sort

---

## Quick start (for HR — run locally)

### Prerequisites
- **Node.js 18+** (Vite 5 requires modern Node)
- npm

### 1) Clone the repository
```bash
git clone <REPO_URL>
cd hr-management
```

### 2) Create the frontend env file

Create `apps/web/.env.local` (or copy from `apps/web/.env.example`) and fill in values provided by the maintainer:
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

> Note: these are **public client credentials** (publishable/anon key). They allow the app to connect to Supabase.

### 3) Install dependencies
```bash
npm install
```

### 4) Run the web app
```bash
npm run dev
```

Open the URL printed in the terminal and:
1) Register/Login
2) Add a job
3) Add a candidate (select job + upload PDF)
4) Wait briefly for automation (optional) to update `matching_score` and `reasoning`

---

## Notes about matching score & reasoning

- The app **displays** `matching_score` (0–100) with a color indicator and shows `reasoning` in “View more”.
- `matching_score` and `reasoning` are typically **written asynchronously** by automation (e.g. n8n).
- If automation is not configured, these fields may remain empty (`—`).

---

## Repository structure

```text
apps/web        # React app (Vite)
apps/supabase   # Supabase migrations + Edge Functions
packages/shared # Shared TS types
```

---

## Maintainers (Supabase setup & deployments)

### Database migrations
Migrations live in `apps/supabase/migrations/`.

Apply to local Supabase:
```bash
cd apps/supabase
npx supabase db push
```

### Edge Functions
Functions live in `apps/supabase/supabase/functions/`.

Deploy examples:
```bash
cd apps/supabase
npx supabase functions deploy add-candidate --no-verify-jwt
npx supabase functions deploy analytics --no-verify-jwt
```

> `--no-verify-jwt` is used because browser calls trigger CORS preflight (OPTIONS) without Authorization.
> Auth is enforced inside the function handlers.

### Supabase function secrets (for n8n webhook)
Set in Supabase (not in repo):
- `N8N_WEBHOOK_URL`
- `N8N_WEBHOOK_SECRET`

---

## Troubleshooting

- **Blank/failed dev server**: verify Node is **18+**
- **Auth works but Edge Functions return 401**:
  - ensure functions are deployed with `--no-verify-jwt`
  - ensure the app points to the correct `VITE_SUPABASE_URL`
- **Match score doesn’t appear**:
  - automation may be disabled/offline, or candidate row not updated yet

