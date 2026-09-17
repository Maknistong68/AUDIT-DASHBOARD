# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server (http://localhost:3000)
npm run build        # production build — run before pushing, it is the type gate
npm run typecheck    # tsc --noEmit (delete stale .next/ first if it names removed routes)
npm test             # vitest run (EHSS scoring engine vs. workbook fixture)
npx vitest run src/lib/ehss/scoring.test.ts -t "reproduces section A"   # single test
```

Dependency notes: vitest is pinned to v3 (npm's resolver chokes on vitest
4's peer graph here); the `postcss` override in package.json clears a
transitive advisory — don't remove either without re-running `npm audit`.

## What this app is

An **EHSS quarterly audit scoring and trend platform** for Oxagon
contractors, modeled 1:1 on the *Excellence EHSS Quarterly Performance
Review* Excel workbook. Two invariants shape everything:

1. **No personal data.** Contractor-level results only; no worker records,
   photos, or auditor phone numbers. Demo data uses generic names.
2. **No free text in the audit.** Answers are Full/Partial/No/N-A; comments
   are the standardized observation codes OB1–OB5 (`src/lib/ehss/model.ts`).
   Every Partial/No answer requires an OB2–OB5 classification. Don't add
   free-text or photo fields.

## Architecture

### The EHSS domain (`src/lib/ehss/`) is the core

- **`checklist.ts`** — GENERATED from the workbook (81 questions, sections
  A/B/C, weights 1–4, plus `WORKBOOK_FIXTURE_ANSWERS`, the workbook's own
  filled audit). Regenerate from the source spreadsheet rather than
  hand-editing; sub-section header typos in the sheet were normalized
  (B11, B12, C1).
- **`scoring.ts`** — the workbook's formula: points = weight × (Full 1,
  Partial 0.5, No 0); N/A excluded from numerator AND denominator;
  sub-section = points/applicable-weight; section = mean of sub-sections;
  total = mean of sections. Unanswered questions are ignored (not counted
  as No); an all-N/A scope scores `null`, never 0. The workbook's manual
  `+0.012` total fudge is intentionally NOT reproduced.
- **`scoring.test.ts`** — pins the engine to the workbook's real numbers
  (A 46.94, B 74.60, C 61, total 60.85). If scoring changes, these
  fixtures are the contract — update only with a matching workbook change.
- **`mock.ts`** — the demo dataset: 2 sub-regions, 5 contractors, quarterly
  2026 audits with deterministically generated answers; audit `e11` is the
  workbook fixture verbatim. `summaries.ts` holds the derived, serializable
  views (client-safe — no server imports) used by pages and the dashboard.

### App shell (Next.js 15 App Router, demo mode)

- **No database, no auth.** Middleware gates on the `demo_profile` cookie
  set by `/welcome` (name + role); role only affects UI affordances.
  Analytics always exclude draft audits.
- `/` renders `DashboardClient` — all filtering (sub-region, contractor)
  happens client-side over props serialized from the mock module. New
  dashboard features: compute in `summaries.ts`, filter in the client.
- The entry form (`app/audits/[id]/EhssAuditForm.tsx`) is client-side
  state only; nothing persists (demo). Live scores come from the same
  `scoreAudit` the tests validate.
- Charts are hand-built SVG (`src/components/charts/`), single accent hue;
  rating badges use the status palette with labels (never color alone).
  Design tokens live in `app/globals.css` (light + dark).

### Dormant Supabase layer

`supabase/` (migrations, seed, RLS, tests) and `src/lib/supabase/` +
`src/app/login/` implement the EARLIER welfare-audit schema — kept for
reference but not reachable from the UI, and the schema does NOT match the
EHSS model. Re-enabling a database means remodeling those migrations to
the EHSS structure first, not just setting env vars. Middleware still
carries the Supabase auth branch (active only when
`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are set and `NEXT_PUBLIC_DEMO_MODE`
isn't "1").

Local DB validation for that legacy schema (needs Postgres 15+; in this
remote container Postgres must run as the `nobody` user — root cannot run
initdb):

```bash
mkdir -p /tmp/pgv && chown nobody /tmp/pgv
su -s /bin/bash nobody -c "cd /; /usr/lib/postgresql/16/bin/initdb -D /tmp/pgv/data -U postgres --no-sync -A trust >/dev/null; /usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgv/data -o '-k /tmp/pgv -c listen_addresses=' -l /tmp/pgv/pg.log start"
PGHOST=/tmp/pgv PGUSER=postgres ./scripts/validate-db.sh
```

### Verification gotcha

`NEXT_PUBLIC_*` vars are inlined at build time. To test the demo locally
the way Vercel runs it, move `.env.local` away BEFORE `next build`, and
kill any old `next-server` process before re-testing — a stale server on
the port will serve the previous build's env behavior.
