# Contractor Audit Dashboard

An **EHSS quarterly audit scoring and compliance-trend platform** for Oxagon
contractors, built from the *Excellence EHSS Quarterly Performance Review*
checklist workbook.

> **Data-minimization principle:** This application records structured,
> contractor-level audit results only. It does not intentionally collect or
> store personal data, worker records, photographs, salary information,
> identification numbers, or individual welfare case information — and the
> audit form has **no free-text fields and no photo uploads**: every entry is
> a controlled selection, so results stay analyzable.

## The model

- **Two sub-regions** (Sub Region 1, Sub Region 2), each with its
  contractors; every contractor gets one review per **quarter**.
- **The checklist** (81 questions from the workbook): Section **A
  Management** (15), **B Process & Procedures** (12 sub-sections, 36), **C
  Planning & Commitment** (C1 Leadership, C2 Planning, 30). Each question
  carries a weight of 1–4.
- **Answers** per question: **Full / Partial / No / N-A** (the workbook's
  dropdown).
- **Pre-made observations** instead of free comments: every Partial or No
  answer must carry one of the standardized classifications **OB2
  Documentation gap · OB3 Implementation gap · OB4 Resources/competence gap
  · OB5 Monitoring/reporting gap** (OB1 = good practice, optional on Full).
  These codes are what the dashboard analyzes.

## Scoring (the workbook's formula)

```
points        = weight × (Full = 100%, Partial = 50%, No = 0%)
N/A           = excluded from numerator and denominator
sub-section   = Σ points ÷ Σ applicable weight
section       = mean of its sub-section scores
TOTAL         = mean of the three section scores
```

Ratings: **Compliant** 90–100 · **Mostly** 80–89 · **Moderately** 70–79 ·
**Minimally** 60–69 · **Non-Compliant** below 60.

The scoring engine is validated against the workbook's own filled audit —
the test suite asserts the exact section scores (A 46.94%, B 74.60%, C 61%)
and total (60.85%). The workbook's manual `+0.012` total adjustment is
deliberately not reproduced.

## The app

- **/** — dynamic dashboard: filter by **sub-region** and **contractor**;
  KPI tiles, quarterly score trend, observation-cause Pareto, section
  performance, weakest sub-sections, contractor standings with ratings.
- **/audits** — quarterly reviews; the draft opens the **entry form**: the
  full checklist with the four-way answer toggle, required observation
  classification on every gap, and live sub-section/section/total scores.
- **/contractors** — register by sub-region with drill-downs (trend, section
  and sub-section breakdown, observation history).
- **/findings** — every gap observation, filterable by sub-region,
  contractor and classification.
- **/admin** — reference view of the checklist, scoring rules, and taxonomy.

Currently runs **database-free**: a built-in demo dataset (five contractors,
14 audits across 2026 — one of them the workbook's real audit) and a
name-and-role onboarding page instead of authentication. **Deploy to Vercel
with no env vars and it just works.** The Supabase layer under `supabase/`
is the earlier welfare-audit schema and is dormant; it needs remodeling to
this EHSS structure before database mode returns.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # scoring engine vs. workbook fixture (15 tests)
npm run typecheck
npm run build
```

Checklist source of truth: `src/lib/ehss/checklist.ts` (generated from the
workbook — regenerate rather than hand-edit if the checklist changes).

## Next steps

1. Remodel the Supabase schema to the EHSS structure (sub-regions,
   quarters, weighted checklist, observations) for real persistence
2. Multi-discipline checklists (the workbook's other sheets) as audit types
3. Quarter-range filter and quarter-over-quarter comparison views
