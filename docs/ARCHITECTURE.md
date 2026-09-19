# Architecture — design rationale

`CLAUDE.md` is the working map of the codebase: what lives where, and the
commands. This document is the *why* — the decisions that shape the model,
and the reasoning you need before changing them.

## 1. The governing principle

> This application is an **audit analytics and compliance-trend platform**.
> It records structured, contractor-level audit results only and does not
> intentionally collect or store personal data, worker records, photographs,
> salary information, identification numbers, or individual welfare case
> information.

Three consequences, each enforced in code rather than by convention:

- **The subject of every record is an organization**, never a person.
  Contractors are identified by project number — `Al Fahd (1272)` — which
  is a work-order reference, not an identity. There is no worker table, no
  auditor table, and no field anywhere that names an individual.
- **No free text in the scoring path.** Every answer is an enum
  (Full / Partial / No / N-A) and every comment is an observation code
  (OB1–OB5). This is what makes the trend analytics trustworthy — auditors
  cannot describe the same problem five different ways — and it is also the
  reason the app cannot accidentally accumulate personal data. A free-text
  box is where a worker's name ends up. There isn't one.
- **No uploads.** No photographs, no attachments, no document store. A site
  photograph is the most likely carrier of personal data in an audit tool,
  so the feature does not exist.

See `docs/COMPLIANCE-KSA.md` for how this maps onto Saudi law.

## 2. Scoring is two layers, and they must not be confused

**Layer 1 — the scorecard.** A contractor's quarterly figure is the
weighted average of five disciplines (`disciplines.ts`):

```
Average = 0.40×H&S + 0.25×Critical Risk + 0.10×Environment
        + 0.10×Security + 0.15×Worker Welfare
```

`weightedOverall()` renormalizes over whichever disciplines are actually
scored, so a partly-scored quarter is not understated. This formula is
pinned to the source scorecard row by row in `disciplines.test.ts` — those
numbers are a contract with the client's own spreadsheet, not test fixtures
to be adjusted.

**Layer 2 — the detailed audits underneath a discipline.** Two exist:

- **Health & Safety** — the 81-question site-walk checklist
  (`checklist.ts`, `scoring.ts`), reproducing the workbook's formula
  exactly: points = weight × (Full 1 / Partial 0.5 / No 0); sub-section =
  points ÷ applicable weight; section = mean of sub-sections; total = mean
  of sections.
- **Critical Risk Control** — a focus audit over 14 hazardous-work items
  (`critical-risks.ts`), scored per hazard.

`AuditSummary.total` is the H&S checklist total. `AuditSummary.overall` is
the weighted scorecard figure. **Dashboards and rankings use `overall`.**
Plotting `total` on a chart labelled with the scorecard is the single
easiest mistake to make here.

## 3. The exclusion rule is the same everywhere

A question answered **N/A**, and a critical-risk hazard **outside a
contractor's scope**, are both excluded from the numerator *and* the
denominator. Neither is scored zero.

This matters more than it looks. A contractor that does no marine work,
scored zero on Working on or Near Water, would lose points against 25% of
its overall score for work it never does. An all-N/A scope scores `null`,
never 0 — and unanswered questions are ignored rather than counted as No,
so a half-finished draft does not read as a failing audit.

## 4. Why findings carry a SHEW pillar

`domains.ts` tags each control as Safety, Health, Environment or Welfare
(Security is a separate discipline, outside SHEW; management-system
controls are Cross-cutting). The pillar sits on the **question**, not the
observation, so every finding inherits it and auditors never pick it. That
keeps entry fast and, more importantly, keeps the grouping consistent
between auditors — a category an auditor selects is a category two
auditors will disagree about.

## 5. State lives in the browser, deliberately

There is no database and no authentication. `store.tsx` merges the
compiled-in baseline dataset with user edits held in `localStorage`;
`/welcome` writes a display name and role to one `httpOnly` cookie, and
middleware requires it.

The role is a **UI affordance, not a security boundary** — it decides which
buttons appear, and nothing more. Nothing in this app is a substitute for
authentication. That arrives with the database.

State starts as the baseline so SSR matches the first client render, which
is why a page looking up a possibly user-created record must wait for
`hydrated` before deciding it is missing.

## 6. When the database arrives

The earlier Supabase layer implemented a *welfare-audit* schema that does
not match this model, and carried a `profiles` table with real names. It
was deleted rather than carried forward (see git history if you need it).
New migrations get modelled on the EHSS structure in `src/lib/ehss/` —
sub-regions, contractors, quarterly reviews, checklist responses, per-hazard
critical-risk scores — and on the residency requirements in
`docs/COMPLIANCE-KSA.md`.

## 7. Validation

```bash
npm test          # scoring engines against the workbook and the scorecard
npm run typecheck # strict TS, noUncheckedIndexedAccess
npm run build     # the real type gate — run before pushing
```

The tests that matter most are the golden ones: `scoring.test.ts` pins the
H&S engine to the workbook's own filled audit (A 46.94, B 74.60, C 61,
total 60.85) and `disciplines.test.ts` pins the weighted average to the
client's scorecard. If a scoring change breaks those, the change is wrong
unless the source document changed too.
