# Contractor Audit Dashboard

An **audit analytics and compliance-trend platform** for contractor welfare/compliance audits.

> **Data-minimization principle:** This application records structured,
> contractor-level audit results only. It does not intentionally collect or
> store personal data, worker records, photographs, salary information,
> identification numbers, or individual welfare case information.
> The only personal data in the system is the minimal account data of the
> application's own users (auditors/admins), handled by Supabase Auth.

## What it records

| Entity | Example |
|---|---|
| Contractor | `ABC Contracting` |
| Audit | `Welfare Management Audit — 2026-09-01` |
| Question / control | `WMP-01 — Worker Management Plan is established and implemented…` |
| Result | `Full Compliance` / `Non-Compliance` / `Not Applicable` |
| NC classification | `Documentation Available but Not Approved` |
| Observation (optional, non-scoring) | `Positive Practice` |
| Corrective action status (NC only) | `Open` → `In Progress` → `Closed` → `Verified` |
| Score | `82.5%` |

No free text in the scoring interface — every field is structured and
controlled, which is what makes the trend analytics reliable.

## Scoring model

- **Full Compliance** → question weight counts fully (100%)
- **Non-Compliance** → question weight counts as 0%, and a standardized
  NC classification is **mandatory**
- **Not Applicable** → excluded from the calculation entirely
- **Observations** (Positive Practice / Improvement Opportunity) are recorded
  separately and never affect the score

```
score = Σ weight(Full Compliance) / Σ weight(all applicable) × 100
```

An audit with zero applicable questions has no score (`NULL`), not 0%.

## Repository layout

```
src/
  app/                  # Next.js App Router
    page.tsx            # overview dashboard (KPIs, trend, NC Pareto, tables)
    contractors/        # league table + per-contractor drill-down
    audits/             # audit list, creation, structured entry form
    login/              # Supabase email/password sign-in
    demo/               # dev-only component gallery with sample data
  components/           # stat tiles, score meters, badges, SVG charts
  middleware.ts         # Supabase session refresh + auth gate
supabase/
  migrations/
    0001_schema.sql     # enums, tables, integrity constraints
    0002_scoring.sql    # scoring function, triggers, analytics views
    0003_rls.sql        # roles, row-level security policies
  seed.sql              # NC taxonomy, Welfare Management Audit question set
  tests/
    harness.sql         # local-Postgres shim for the Supabase auth schema
    smoke_test.sql      # end-to-end DB assertions (scoring, constraints, RLS)
src/lib/
  types.ts              # shared domain types (mirror of the DB enums)
  scoring.ts            # client-side scoring + aggregation (mirrors the DB)
  scoring.test.ts       # unit tests
docs/
  ARCHITECTURE.md       # full design: data model, scoring, KPIs, roles, RLS
scripts/
  validate-db.sh        # spins the migrations + seed + smoke tests against a
                        # local Postgres (see script header for usage)
```

## Running the app

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev                  # http://localhost:3000
```

Apply `supabase/migrations/*.sql` and `supabase/seed.sql` to your Supabase
project (e.g. `supabase db push`), create users in Supabase Auth, and promote
the first admin by setting their `profiles.role` to `admin`. Without
configured env vars the app renders a setup notice; with them, all routes
require sign-in. In development, `/demo` shows every dashboard component with
sample data and no Supabase needed.

## Running the checks

```bash
npm test                # TypeScript scoring unit tests (vitest)
npm run typecheck
npm run build           # production build

# Database validation against any local Postgres 15+:
PGHOST=/tmp/pgv PGUSER=postgres ./scripts/validate-db.sh
```

## Demo mode (no database)

When Supabase env vars are absent (or `NEXT_PUBLIC_DEMO_MODE=1`), the app
runs entirely on a built-in dataset (`src/lib/demo/`): no database, no
authentication — a lightweight onboarding page (name + role, stored in a
cookie) replaces login. All dashboards are populated (Contractor One/Two/
Three, six audits), the draft audit's scoring form works live, and every
mutation is blocked with a "demo mode" message. **Deploy to Vercel with no
env vars and you get this demo.** Setting the two Supabase env vars switches
the app back to real database mode automatically.

## Deploying

Step-by-step Supabase + Vercel instructions: **`docs/DEPLOYMENT.md`**.
`supabase/setup.sql` applies the whole schema in one SQL-editor paste, and
`supabase/mock_data.sql` loads a demo dataset (Contractor One/Two/Three)
so the dashboards are populated on first login.

## Deployment target

Vercel (Next.js frontend) + Supabase (Postgres, Auth, RLS). Because the audit
dataset is organizational/compliance information rather than personal data,
the hosting question is primarily an internal IT/security approval matter —
verify the project's approved cloud architecture before putting real project
data into production.

## Next steps

1. Replace hand-written row types with `supabase gen types typescript`
2. Dashboard filters (date range, audit type) scoping all charts at once
3. Audit-type management in the admin section
