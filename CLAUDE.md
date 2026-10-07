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
workbook and the master contractor scorecard.

**Five audits are being developed**, one per scorecard discipline: H&S,
Critical Risk Control, Environment, Security and Worker Welfare. Only H&S
has its full checklist so far (81 questions) and CRC has its 14-hazard
register; the other three carry a recorded score until their checklists
arrive. Anything built for H&S should be written so the other four can use
it — the issue taxonomy, the recurrence model and the analytics are all
discipline-agnostic by design, and new work should stay that way rather
than hard-coding the H&S checklist.

Two invariants shape everything:

1. **No personal data.** Contractor-level results only; no worker records,
   photos, or auditor phone numbers. The only personal data in the whole app
   is the optional display name in the `demo_profile` cookie. This is a
   Saudi PDPL compliance position, not a preference —
   `docs/COMPLIANCE-KSA.md` is the assessment, and §2 of it is the Record of
   Processing Activities. **It is also what lets the data be hosted outside
   the Kingdom** (§4): the project determined the data is not sensitive *on
   the basis that it names nobody*. A field that names a person does not
   just add a feature — it changes which laws apply and where the system may
   run.
2. **No free text in the audit.** Answers are Full/Partial/No/N-A, and the
   reason is picked from the twelve **issue categories** in
   `src/lib/ehss/issues.ts` — never typed. At least one gap category is
   required on every Partial/No, and **several may apply**: a finding
   usually has more than one cause, and forcing one label loses the rest.
   Don't add free-text or photo fields; a comments box is how an audit tool
   acquires personal data by accident.

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
- **The dashboard is ONE chart.** `/` is a league-table bar chart that fills
  the viewport, and everything else is reached by drilling into it: select a
  bar for that contractor's ranked problems (`ContractorPanel`), select a
  problem for the evidence behind it (`ProblemPanel`). Programme-wide
  analysis lives on the page it belongs to — findings analysis (SHEW
  heat-map, CRC hazards, observation trends) on `/findings`, trajectories on
  `/contractors`. Do not add a second card to `/`; if something deserves
  dashboard space, it replaces the chart or it goes on another page.
- **Nothing on `/` scrolls above 860px, structurally.** `.shell:has(.board)`
  is exactly `100dvh` with `overflow: hidden`, the chart row is
  `minmax(0, 1fr)`, and `ContractorBarChart` draws at its container's
  measured height (`useChartBox`) rather than at a height derived from its
  data. The drill-down panels are a fixed box whose list rows share the
  space (`flex: 1 1 0` with a max), and the lists are capped in
  `summaries.ts` — six problems, eight pieces of evidence — so they fit by
  construction rather than by overflow. Below 860px the page scrolls
  normally; sideways it must never scroll at any width from 320px up.
- `contractorProblems()` / `problemEvidence()` / `problemPeer()` in
  `summaries.ts` are the drill-down model: a "problem" is a checklist area,
  a critical-risk hazard or a question, ranked by gap to target amplified
  when the trend is flat or declining.
- **Recurrence** (`findingHistories()` and friends): the same question
  tracked answer-by-answer across a contractor's quarters. Two rules decide
  everything and are pinned in `recurrence.test.ts` — a finding is
  `recurring` at `RECURRING_THRESHOLD` (3) consecutive open reviews, and
  **N/A never closes a finding** ("not applicable this quarter" usually
  means the work was not running, which is not evidence anything was
  fixed; it breaks the streak without earning a closure). `reopened`
  outranks `recurring`: a fix that did not hold is worse than one never
  attempted. Surfaced as the movement strip and row flags in the
  drill-down, the "Findings across quarters" card on `/findings`, and the
  movement tiles on `/brief`.
- `mock.ts` answers are **sticky** across quarters (most of each draw comes
  from the contractor-and-question pair, little from the quarter). Drawing
  each quarter independently made nearly every finding look reopened the
  next quarter and the recurrence view read as noise. Keep it sticky.
- New dashboard features: compute in `summaries.ts`, filter in the client.
- **Programme-wide analysis is one destination, two tabs** (`AnalysisTabs`):
  `/findings` is observation-centric (the gap register, SHEW heat-map,
  observation trends, findings across quarters, CRC hazards) and
  `/checklist` is question-centric (the contractor × checklist-area matrix
  and the most widely failed questions). They share the Findings nav entry
  because **the phone tab bar is full at five labels** — "Contractors" sets
  the floor and only just fits at 360px. Do not add a sixth primary nav
  item; add a tab.
- The checklist analysis answers "is this ours or theirs": `failRate` in
  `checklistQuestionStats()` counts CONTRACTORS, not answers, so one
  contractor failing the same question four quarters running does not read
  as a programme-wide failure. `checklistAreas()` treats section A as one
  area (its questions have no sub-section) plus B1–B12, C1, C2 — 15 areas,
  81 questions, pinned in `checklist-analysis.test.ts`.
- **Issue categories** (`issues.ts`) answer *why* a requirement was not met,
  which the checklist never says. Two rules hold the list together: every
  category implies a **different fix and a different owner** (merge any two
  that don't), and **nothing is specific to one discipline** — the same
  twelve serve all five audits, so a report can compare across them. They
  are **multi-select**, so every count derived from them (the SHEW heat-map
  cells, `issueBreakdown`, `issueTrendByQuarter`) sums to MORE than the
  number of findings; each view says so, and that is not a bug to fix by
  dropping categories. `readIssues()` upgrades records written before the
  change — the superseded OB1–OB5 map to their nearest single category
  rather than being expanded into guesses nobody made.
- Trends over categories use **small multiples** (`IssueTrendGrid`), not one
  plot: twelve lines is a thicket, and plotting "the top five" would repaint
  the colours whenever a filter changed the ranking.
- Charts are hand-built SVG (`src/components/charts/`), single accent hue;
  rating badges use the status palette with labels (never color alone).
  Charts draw at their container's measured width via `useChartWidth`, so
  type is never scaled down — don't reintroduce a fixed `viewBox` width.
- `globals.css` is one long file whose section comments are NOT reliable
  boundaries: unrelated rules sit between them. **Never delete a range
  between two section markers.** Removing the brief that way silently took
  the floating panel, rating key, scorecard, discipline panels, chart legend
  and spark grid with it, and the build, the type gate and 126 tests all
  passed — CSS has no type checker. Delete rule by rule, then diff the
  selector list against the previous version
  (`grep -oE "^\.[a-zA-Z][-a-zA-Z0-9_]*" ... | sort -u | comm`) and open
  every page that used them.
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
`src/lib/ehss/` and read `docs/COMPLIANCE-KSA.md` §4 and §5.5 first. The
region is **unconstrained** — the project has determined this data is not
sensitive and may be stored outside the Kingdom — so pick on latency, cost
and operational fit. The no-personal-data schema rules are what keep that
determination true, so they are decided before the first migration, not
after.

`middleware.ts` gates on the `demo_profile` cookie and nothing else. The
role is a UI affordance, not a security boundary.

### Verification gotcha

`NEXT_PUBLIC_*` vars are inlined at build time. To test the demo locally
the way Vercel runs it, move `.env.local` away BEFORE `next build`, and
kill any old `next-server` process before re-testing — a stale server on
the port will serve the previous build's env behavior.
