# Contractor EHSS Audit Dashboard

Quarterly EHSS performance scoring and trend analytics for Oxagon
contractors, built on the *Excellence EHSS Quarterly Performance Review*
checklist and the master contractor scorecard.

> **Data-minimization principle:** contractor-level results only. No worker
> records, photographs, salaries, ID numbers or individual case information —
> and the audit form has **no free-text fields and no photo uploads**: every
> entry is a controlled selection, so results stay analyzable.

## The model

- **Two sub-regions** (Sub Region 1, Sub Region 2) holding the contractor
  register; contractors are identified by project number, e.g.
  `Al Fahd (1272)`.
- **Five weighted disciplines** make up a contractor's quarterly score:

  | Discipline | Weight | Scored by |
  |---|---|---|
  | Health & Safety | 40% | the 81-question checklist |
  | Critical Risk Control | 25% | recorded score |
  | Environment | 10% | recorded score |
  | Security | 10% | recorded score |
  | Worker Welfare | 15% | recorded score |

  `Average = 0.40×H&S + 0.25×CRC + 0.10×Env + 0.10×Sec + 0.15×WW` — verified
  against the source scorecard: every readable row reproduces to a tenth of
  a point.

- **The H&S checklist**: 81 weighted questions in sections A Management,
  B Process & Procedures (12 sub-sections), C Planning & Commitment.
  Answers are **Full / Partial / No / N-A**; every Partial or No requires a
  standardized observation code (**OB2** documentation, **OB3**
  implementation, **OB4** resources/competence, **OB5** monitoring; **OB1**
  is a positive note).
- **Ratings**: Compliant 90–100 · Mostly 80–89 · Moderately 70–79 ·
  Minimally 60–69 · Non-Compliant below 60. The 90% target drives every
  "gap to target" figure.

## The app

| Page | What it answers |
|---|---|
| **Brief** | The one-pager: overall score, where it comes from, *what to focus on* (areas below target that are not improving — "no improvement across 4 reviews") and *what is working and should be kept up*. Programme-wide or per contractor. |
| **Dashboard** | League table of active contractors, filterable by sub-region and timeframe (latest / last 3 / last year / all). Click a bar for that contractor's trend, discipline split, priority areas and top issues. |
| **Contractors** | The master scorecard: a column per discipline, weighted average, rating and rank. Contractors are activated/deactivated here when projects complete. |
| **Audits** | Quarterly coverage — every active contractor needs one review per quarter — plus review creation and the full entry form. |
| **Findings** | Every gap observation, filterable by sub-region, contractor and classification. |
| **Reference** | Checklist, scoring rules and observation taxonomy. |

Scores are recomputed live as a review is filled in, and the H&S checklist
total becomes the H&S discipline score when a review is submitted.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # scoring engine + scorecard + analytics (55 tests)
npm run typecheck
npm run build
```

The app runs **database-free**: the dataset lives in `src/lib/ehss/mock.ts`
and user edits (new reviews, answers, activation) persist in the browser via
`localStorage`. Deploy to Vercel with **no environment variables** and it
works. Authentication is replaced by a name-and-role welcome screen.

## Next steps

1. Checklists for the other four disciplines (only their scores are recorded
   today)
2. A server-side database so reviews are shared between users
3. Export of the brief to PDF for distribution
