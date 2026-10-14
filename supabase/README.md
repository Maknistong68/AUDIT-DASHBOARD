# The database

Everything the app knows lives here and is editable. Nothing about the
checklist, the categories, the weights or the contractors is compiled into
the app any more.

## The system is two things

**1. Reference — set up once, edit when the programme changes.**

| Table | What it holds |
|---|---|
| `checklist_sections` / `checklist_subsections` / `checklist_questions` | the 81 H&S questions, their weights and pillars |
| `issue_categories` | the 13 reasons a requirement was not met |
| `critical_risks` | the 14 hazardous-work items |
| `disciplines` | H&S 40%, Critical Risk 25%, Environment 10%, Security 10%, Worker Welfare 15% |
| `rating_bands` | Compliant 90+, Mostly 80+, Moderately 70+, Minimally 60+, Non-Compliant below |
| `shew_domains` | the SHEW pillars |
| `sub_regions` / `contractors` | who gets audited |

Change a question's weight here and the app follows. Add a contractor here
and it appears. No deploy.

**2. Audits — entered every quarter.**

| Table | What it holds |
|---|---|
| `audits` | one review: contractor, quarter, date, status |
| `audit_responses` | the answer per question — Full / Partial / No / N-A |
| `audit_response_issues` | why, from `issue_categories`. **Several may apply** |
| `audit_area_scores` | area points, for a review imported from a sheet instead of answered question by question |
| `audit_discipline_scores` | a recorded score for a discipline with no checklist yet |
| `audit_critical_risks` | one row per hazard in the contractor's scope |

## Running it

In the Supabase SQL editor, in this order:

```
migrations/0001_schema.sql          tables, constraints, row-level security
migrations/0002_reference_data.sql  pillars, disciplines, bands, categories, hazards
migrations/0003_checklist.sql       the 81 questions
migrations/0004_contractors.sql     sub-regions and the 13 contractors
```

Then **optionally**:

```
seed_audits_2025Q4_2026Q1.sql       the 19 real audits for Q4 2025 and Q1 2026
```

Skip that last one to start from an empty system and enter everything by
hand. Run it to have the two verified quarters already loaded. Every file is
safe to re-run — they all use `on conflict do nothing`.

## What the database refuses

These are the real mistakes from the source spreadsheets, made impossible:

- **More points than were applicable.** One area in the Q1 2026 sheet was
  scored 21.5 out of 21.
- **Two reviews for one contractor in one quarter.** One contractor's figures
  had been pasted under another's name.
- A malformed quarter, an answer that is not Full/Partial/No/N-A, a score
  above 100, an issue category that does not exist.
- **A full company name or a full work order in `contractors`.** The column
  is too short to hold one. That is the compliance position made structural:
  this data may be hosted outside the Kingdom *because* it identifies nobody
  and nothing (`docs/COMPLIANCE-KSA.md` §4).

There is no column anywhere for an auditor's name, a phone number, a worker
record, a photograph, or a free-text comment. A comments box is how an audit
tool acquires personal data by accident.

## Two things to decide before anyone else gets the URL

1. **Who may enter an audit versus only read one.** The policies as shipped
   let any signed-in person do anything, including approve and delete. That
   is deliberately simple and is not a permission model.
2. **Whether to let the anon key write** while you are setting up by hand.
   `0001_schema.sql` ends with the SQL to allow it and a warning: the anon
   key ships in the browser, so anyone holding it could rewrite every audit.

## Scoring is not in here, on purpose

The weighted formula lives in `src/lib/ehss/scoring.ts`, pinned by tests to
the source workbook. Implementing it again in SQL would create a second
version to keep in step — exactly the drift that put the entry spreadsheet
0.01 out from the app. The database stores facts; the app scores them.

Verified on Postgres 16: all five files run clean, and the 19 seeded audits
recompute to the same totals the dashboard shows, to the hundredth
(ABYATONA 134 Q4 2025 = 58.34, RPCO Q1 2026 = 45.76).

## Regenerating

```bash
python3 scripts/build-supabase-sql.py
```

Reads the app's own data modules and rewrites the seed files, asserting the
counts: 81 questions, 13 categories, 14 hazards, 5 disciplines, 5 bands,
13 contractors, 19 audits. The database and the app cannot disagree about
what a question weighs.
