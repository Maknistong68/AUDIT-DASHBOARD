# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server (http://localhost:3000; /demo works without Supabase)
npm run build        # production build — run before pushing, it is the type gate
npm run typecheck    # tsc --noEmit
npm test             # vitest run (scoring unit tests)
npx vitest run src/lib/scoring.test.ts -t "applies question weights"   # single test

# Full database validation (throwaway DB: shim → migrations → seed → smoke tests):
PGHOST=<socket-dir-or-host> PGUSER=postgres ./scripts/validate-db.sh
```

`validate-db.sh` needs any local Postgres 15+ (15 is the floor: views use
`security_invoker`). In the remote Claude container, Postgres must run as the
`nobody` user (root cannot run initdb):

```bash
mkdir -p /tmp/pgv && chown nobody /tmp/pgv
su -s /bin/bash nobody -c "cd /; /usr/lib/postgresql/16/bin/initdb -D /tmp/pgv/data -U postgres --no-sync -A trust >/dev/null; /usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgv/data -o '-k /tmp/pgv -c listen_addresses=' -l /tmp/pgv/pg.log start"
PGHOST=/tmp/pgv PGUSER=postgres ./scripts/validate-db.sh
```

Dependency notes: vitest is pinned to v3 (npm's resolver chokes on vitest 4's
peer graph here); the `postcss` override in package.json clears a transitive
advisory — don't remove either without re-running `npm audit`.

## What this app is (and is not)

An audit analytics platform recording **contractor-level** compliance results
only. Two invariants shape everything:

1. **No personal data in the audit dataset.** No worker names, IDs, photos,
   salaries, or case records — contractors are organizations. The only
   personal data is the app's own user accounts (Supabase Auth + `profiles`).
2. **No free text in the scoring path.** Every scoring field is an enum or an
   FK into a controlled vocabulary (`nc_categories`). This is enforced by
   schema constraints, not just UI, and is what makes the analytics reliable.
   Don't add free-text fields to audits/responses.

`docs/ARCHITECTURE.md` is the full design document (data model, scoring
rules, RLS matrix, KPI-to-view mapping). Keep it current when changing any
of those.

## Architecture

### The database is the source of truth; the client mirrors it

Scoring exists twice, deliberately identical:

- `public.calculate_audit_score()` (`supabase/migrations/0002_scoring.sql`) —
  a trigger on `audit_responses` keeps the denormalized `audits.score`
  current. Rule: `Σ weight(full_compliance) / Σ weight(≠ not_applicable) × 100`;
  an all-NA audit scores `NULL`, never 0.
- `src/lib/scoring.ts` — the same algorithm for the entry form's live
  provisional score and dashboard aggregation.

Both are pinned to the same fixture (3 FC + 1 NC + 1 NA → 75.00) by
`supabase/tests/smoke_test.sql` and `src/lib/scoring.test.ts`. If you change
one side, change the other and both test suites.

The score-refresh trigger (replaced in `0004`) skips updates that don't
change `result` — this is what stops a corrective-action update from
recomputing a historical score with *current* question weights. Don't
"simplify" that early return away.

### RLS is the security boundary; UI checks are cosmetic

The browser only ever holds the anon key. Server actions pass writes through
the user's own session, so every permission lives in
`supabase/migrations/0003_rls.sql`:

- Roles (`admin`/`auditor`/`viewer`) live on `profiles`, read via the
  `SECURITY DEFINER` helper `current_user_role()` (avoids RLS recursion).
- Draft audits are private to their auditor (+ admins); submitted/approved
  are visible to all authenticated users. Auditors lose write access at
  submission; only admins approve.
- Column-level grants stop non-admins updating `audits.score` (trigger-owned)
  and `audits.auditor_id`. The score trigger works anyway because its
  function is `SECURITY DEFINER` (owner bypasses RLS).
- Post-submission corrective actions go **only** through the
  `update_corrective_action()` RPC (`0004`), which permits the audit's own
  auditor or an admin to change that single column.

Any change to schema or policies needs a matching assertion in
`supabase/tests/smoke_test.sql` (it tests per-role via
`set role authenticated` + a `request.jwt.claim.sub` setting that the
`auth.uid()` shim in `supabase/tests/harness.sql` reads — the harness exists
only for local Postgres; real Supabase provides all of it).

### Dashboards read views, never tables

All analytics go through the `v_*` views in `0002_scoring.sql`. They are
`security_invoker` (reader's RLS applies) and exclude drafts, so
half-entered audits never skew a chart. New dashboard features should add or
extend views, not query base tables.

### Frontend layout (Next.js 15 App Router, `src/`)

- Server components fetch via `lib/supabase/server.ts` and cast rows to the
  hand-written types in `src/lib/db.ts` — those types must be kept in sync
  with the schema until they're replaced by `supabase gen types typescript`.
- Mutations are server actions: `app/audits/actions.ts`,
  `app/admin/actions.ts`, `app/actions-queue/actions.ts`. Admin and queue
  pages use plain `<form action={...}>` (no client JS) and surface failures
  by redirecting back with `?error=`; the audit entry form
  (`app/audits/[id]/AuditEntryForm.tsx`) is the one stateful client
  component (local entry state + live score).
- `hasSupabaseEnv()` gates every page: an unconfigured clone renders
  `SetupNotice` instead of crashing, which is also what lets `next build`
  pass with no env vars. Data pages set `export const dynamic = "force-dynamic"`.
- `middleware.ts` refreshes the Supabase session and redirects signed-out
  users to `/login`; it passes through when env is unconfigured.
- Charts are hand-built SVG client components (`src/components/charts/`) —
  no chart library. Design tokens (light + dark) live in
  `app/globals.css`; the palette follows the validated dataviz reference
  (single accent blue for data, status colors only for badges with labels).
- `/demo` is a dev-only component gallery with sample data (calls
  `notFound()` in production). Use it to eyeball UI changes without a
  Supabase instance — there is no way to render the real pages locally
  without one.

### Migrations

`supabase/migrations/` is ordered and append-only — new DDL goes in a new
`000N_*.sql` file; later files may `create or replace` earlier functions
(0004 does this to `refresh_audit_score`). `supabase/seed.sql` must stay
idempotent (`on conflict do nothing`).
