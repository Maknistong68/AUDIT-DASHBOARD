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

Dependency notes: three runtime dependencies (next, react, react-dom) and
no others — keep it that way unless there is a real reason. The `postcss`
override in package.json is load-bearing: without it Next pins a vulnerable
8.4.31. Re-run `npm audit` after touching either.

## What this app is

An **EHSS quarterly audit scoring and trend platform** for Oxagon
contractors, modeled on the *Excellence EHSS Quarterly Performance Review*
workbook and the master contractor scorecard. Two invariants shape
everything:

1. **No personal data.** Contractor-level results only; no worker records,
   photos, or auditor phone numbers. The only personal data in the whole app
   is the optional display name in the `demo_profile` cookie. This is a
   Saudi PDPL compliance position, not a preference —
   `docs/COMPLIANCE-KSA.md` is the assessment, and §2 of it is the Record of
   Processing Activities. Adding a field that names a person invalidates it.
2. **No free text in the audit.** Answers are Full/Partial/No/N-A; comments
   are the standardized observation codes OB1–OB5 (`src/lib/ehss/model.ts`).
   Every Partial/No answer requires an OB2–OB5 classification. Don't add
   free-text or photo fields.

## Architecture

### Scoring is two layers

1. **Disciplines** (`disciplines.ts`): the scorecard's five weighted
   disciplines — H&S 40%, Critical Risk 25%, Environment 10%, Security 10%,
   Worker Welfare 15%. `weightedOverall()` is the contractor's quarterly
   score and renormalizes over whichever disciplines are scored.
   `disciplines.test.ts` pins it to the source scorecard row by row — treat
   those numbers as the contract.
2. **The H&S checklist** (below) scores the Health & Safety discipline in
   detail. The other four carry a recorded score until their own checklists
   exist. `AuditSummary.total` is the checklist total; `AuditSummary.overall`
   is the weighted scorecard figure — dashboards and rankings use `overall`.
   A recorded `disciplineScores.hs` wins over the checklist total (historical
   transcription); submitting a review writes the checklist total into it.

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
- **`mock.ts`** — the dataset: 2 sub-regions, the 11 real contractors from
  the scorecard (identified by project number via `contractorLabel`), and
  four quarters of reviews. 2026-Q3 discipline scores are transcribed from
  the scorecard; earlier quarters are derived by a per-contractor trend.
  `afh1272`'s 2026-Q3 is the workbook audit verbatim (its H&S comes from the
  checklist, so it reads 60.85 rather than the sheet's manually adjusted
  62.0); `tdp`'s 2026-Q3 is an open draft.
- **`summaries.ts`** — derived, client-safe views: timeframe windows
  (`windowByContractor`, latest / last3 / last4 / all), `contractorStats`
  (the league table), `topIssues` (weighted points lost per question), and
  `areaTrends`/`focusAreas`/`strengthAreas`, which power the executive
  brief's "no improvement across N reviews" lines. Area trends average per
  quarter, so they work programme-wide as well as per contractor.

### App shell (Next.js 15 App Router, demo mode)

- **No database, no auth.** Middleware gates on the `demo_profile` cookie
  set by `/welcome` (name + role); role only affects UI affordances.
  Analytics always exclude draft audits.
- **`store.tsx` is the data layer.** `EhssStoreProvider` (mounted in the root
  layout) merges the `mock.ts` baseline with user overrides persisted in
  `localStorage`: new reviews, edited answers, discipline scores, contractor
  activation. Pages read it through `useEhss()`, so most pages are client
  components; server pages only read the cookie and pass `role`/params down.
  State starts as the baseline so SSR matches the first client render —
  a page looking up a possibly user-created record must wait for `hydrated`
  before deciding it is missing.
- New dashboard features: compute in `summaries.ts`, filter in the client.
- `/brief` is the executive one-pager (what to focus on / what is working) —
  the view the project director actually reads; keep it to one page.
- Charts are hand-built SVG (`src/components/charts/`), single accent hue;
  rating badges use the status palette with labels (never color alone).
  Charts draw at their container's measured width via `useChartWidth`, so
  type is never scaled down — don't reintroduce a fixed `viewBox` width.
- Design tokens live in `app/globals.css` (light + dark), in two layers that
  must not be mixed: **semantic** tokens (`--ink-*`, `--accent`, `--band-*`,
  `--series-*`) carry meaning and are the validated palette; **material**
  tokens (`--mat-*`, `--shadow-*`, `--r-*`) carry depth only. `--surface-1`
  stays an opaque colour — SVG has no `backdrop-filter`, so chart rings and
  surface gaps need the composite the glass resolves to (light `#f8fafd`,
  dark `#171a21`). That is also the surface the palette was validated
  against; change the glass and you re-validate.
- Responsive tiers: >1099px full desktop · ≤1099px tighter nav, 2×2 KPIs ·
  ≤860px the pill nav hands over to the fixed bottom tab bar (`NavBar.tsx`,
  which also carries the phone-only admin Reference shortcut) · ≤620px phone
  layout, bottom sheets, full-width controls. Wide tables live in a
  `.table-scroll` wrapper; the page itself must never scroll sideways at any
  width from 320px up.

### No database, and what that means

There is no Supabase layer, no migrations and no auth — the earlier
welfare-audit schema was deleted (see git history). It did not match the
EHSS model and carried a `profiles` table of real names, so re-enabling it
was never the path forward. When a database is added, model it on
`src/lib/ehss/` and read `docs/COMPLIANCE-KSA.md` §4 and §5.7 first: the
hosting region and the no-personal-data schema rules are decided before the
first migration, not after.

`middleware.ts` gates on the `demo_profile` cookie and nothing else. The
role is a UI affordance, not a security boundary.

### Verification gotcha

`NEXT_PUBLIC_*` vars are inlined at build time. To test the demo locally
the way Vercel runs it, move `.env.local` away BEFORE `next build`, and
kill any old `next-server` process before re-testing — a stale server on
the port will serve the previous build's env behavior.
