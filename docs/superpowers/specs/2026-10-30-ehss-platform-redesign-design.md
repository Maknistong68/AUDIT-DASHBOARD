# EHSS platform redesign — design

Date: 2026-10-30 · Status: approved in conversation, awaiting written review

## 1. Goal

Make the app the place the EHSS programme is read and run, with the Excel
audit sheets as its source of truth:

- **Executives** read the programme at a glance: charts, not sentences.
- **Auditors** enter audits and find any past observation in seconds.
- **Everyone** sees the same data, because it lives in one shared database.

Success: every number on screen traces back to a cell in a source sheet (or
to an audit entered in the app), the observation log is complete and
searchable, and no screen repeats another.

## 2. Decisions taken (owner, 2026-10-30)

| # | Decision |
|---|---|
| D1 | The Excel sheets are the truth. Everything in them comes in **except** photographs, the sheet's own stated scores (they disagree with their points), auditor names, phone numbers and full work orders. Scoring stays exactly as `scoring.ts` computes it. |
| D2 | Observation **text** is imported, with names of people removed. |
| D3 | Claude assigns the cause categories to every imported observation once; auditors correct them in the app. |
| D4 | **Supabase** is the shared database. Anything entered is visible to everyone. |
| D5 | Four role accounts, no personal emails: `admin`, `auditor1`, `auditor2`, `viewer`. |
| D6 | Board: the large card is split top/bottom (option A in the mockup). |
| D7 | One home per thing, four tabs: Board, Contractors, Reports, Observations. |
| D8 | Keep the existing colours, tokens and component styling. This work changes content, layout and motion only. |
| D9 | Motion: Apple's curve `cubic-bezier(0.32, 0.72, 0, 1)` at 1.5 s for entrances and transitions; hover feedback is immediate (≤ 200 ms). |
| D10 | Labels sit on the marks; no legend rows and no explanatory sentences on the board. |

Mockup of D6/D9/D10: https://claude.ai/artifact/2ufBnBs6xenNSGT85FoWEw

## 3. Structure

Four primary tabs plus an admin icon. Every screen has one job; a figure
shown in two places is a defect.

| Tab | Job | Replaces |
|---|---|---|
| **Board** | Programme summary for executives | `/` (minus Watchlist, Latest reviews, Against target — they repeat the bars) |
| **Contractors** | One row per contractor; its page is **all its reports combined** | `/contractors` (trajectories and the two scorecard tables merge into one list) |
| **Reports** | Every audit in one table; its page is **one quarter's report**, and where auditors enter and edit | `/audits` (coverage table and "All reviews" merge) |
| **Observations** | The log of every observation, searchable and filterable | `/findings` and `/checklist` |
| Admin (icon) | Accounts, contractor register, Excel import | `/admin`, Reference |

**Navigation rule.** A view of ONE quarter links to that quarter's report
(`/reports/[id]`). A view spanning SEVERAL quarters links to the contractor's
combined page (`/contractors/[id]`). This applies everywhere, not only on
the board.

## 4. Screens

### 4.1 Board
Order, top to bottom:

1. **Headline** — programme average, gap to target as a `TargetBar`, the
   five rating bands as counts (the existing `HeroTile`, unchanged in
   content).
2. **Split card** (full width), per the mockup:
   - Top half: the selected quarter, one bar per contractor, weakest first,
     value printed on each bar, target line.
   - Bottom half: one line chart — the selected contractor across every
     quarter on record, the programme average, the target. End-of-line labels
     only. Header: contractor name and change since the previous quarter,
     plus two buttons: **"<Quarter> report"** and **"All reports"**.
   - Hover previews a bar; **click selects** it and moves the line (1.5 s).
     Clicking a point on the line opens that quarter's report. Default
     selection: the weakest contractor.
   - A contractor with one review shows a single point and "First review".
3. **Weakest areas** — the fifteen checklist areas, worst first, as
   `TargetBar`s (moves here from `/findings`).
4. **Causes** — the seven cause categories as a bar chart over the selected
   quarter's observations, each bar linking to the log filtered to it.
5. **Counts** — audited of active, recurring gaps, open actions.

Removed: Watchlist, Latest reviews, Against target, the programme-trend tile
(the split card's bottom half carries the programme average over time).

### 4.2 Contractors
- List: one row per contractor — latest score, band, sparkline across
  quarters, change. Sorted weakest first. Search box.
- Contractor page (combined, all quarters): score line over quarters, the
  fifteen areas against target (latest vs previous), causes across all their
  observations, recurring areas, and their observations (the log, prefiltered).

### 4.3 Reports
- Register: one table of every audit — quarter, contractor, sub-region, date,
  status, score, band — with search and filters (quarter, sub-region,
  status). Contractors with no audit in the selected quarter appear as
  "Not started" rows with a Start button (the coverage view, folded in).
- Report page (one quarter): the score summary, the fifteen areas, the
  checklist answers where recorded, and **this audit's observations** with
  their causes. Auditors edit here: answers, area points, observations,
  causes. Existing draft → submitted → approved workflow is kept.
- Observation entry: a text box per observation plus the seven cause toggles.
  A name guard warns when the text matches a person pattern (§6.3) and the
  observation cannot be saved until the auditor rewrites it or confirms it
  names no one.

### 4.4 Observations
- A search box (full text, instant) and filters in one row: quarter,
  sub-region, contractor, checklist area, cause, kind (gap / positive / site
  finding), and "needs a cause".
- Above the list: one bar chart of causes for the current filter, and the
  count of matching observations.
- Each row: contractor, quarter, question code, kind, the text (two lines,
  expandable), cause chips (editable by auditors and the admin), link to the
  report it came from.
- 50 rows per page; the filter state lives in the URL so a view can be sent.

### 4.5 Motion and hover (all screens)
- Entrances: cards rise 14 px and fade in; bars grow from the baseline,
  staggered 50 ms; lines draw left to right. 1.5 s on the D9 curve.
- Transitions between states (selection, filter, quarter): 1.5 s on the same
  curve.
- Hover: a card lifts 3 px with a deeper shadow; marks show a tooltip with
  their detail. Immediate.
- `prefers-reduced-motion` turns every duration to zero.

## 5. Data

### 5.1 Tables (Supabase / Postgres)

| Table | Holds | Notes |
|---|---|---|
| `contractors` | id, code (initials + last 3 of work order), sub_region, active | No full work order, no names |
| `audits` | id, contractor_id, quarter, audit_date, inspection_no, status, area_points (jsonb), responses (jsonb), discipline_scores (jsonb), source (`excel` / `app`), source_ref | Scores are always computed in the app, never stored |
| `observations` | id, audit_id, kind (`gap` / `positive` / `site`), question_code (nullable), text, causes (text[]), causes_source (`claude` / `auditor`), sort_order | `text` is the only free-text column |
| `actions` | as `actions.ts` today | Owner is a function, never a person |
| `trail` | at, account_role, account_id, entity, entity_id, change (jsonb) | Opaque account id, no name |
| `settings` | as `settings.ts` today | Versioned by effective quarter |

`account_id` is Supabase's opaque user id. No table has a column for a
person's name, phone or email; the four emails live only in Supabase's own
auth schema.

### 5.2 Access rules
- Row-level security **on every table**, enabled in the first migration.
- The role is read from `auth.jwt() -> 'app_metadata' ->> 'role'` (set by the
  admin, not editable by the user).
  - `viewer`: read everything.
  - `auditor`: read everything; insert and update audits, observations and
    actions; cannot change contractors, accounts or settings; cannot delete
    an approved audit.
  - `admin`: everything.
- The service-role key is used only in server code (import route, account
  management, seeding). It is never in a `NEXT_PUBLIC_` variable.
- A test fails the build if any table in the schema lacks RLS or policies.

### 5.3 Accounts
- Usernames `admin`, `auditor1`, `auditor2`, `viewer`. Each maps to a
  placeholder email `<username>@ehss.internal` (fallback `@example.com`,
  which is reserved and never deliverable, if Supabase rejects the first).
- Created with the admin API and `email_confirm: true`, so no email is ever
  sent. The login form asks for username and password only.
- Temporary passwords are generated at setup, given to the owner once, and
  never committed. Each account changes its password at first login. A
  forgotten password is reset by the admin from the Admin screen.
- The `demo_profile` cookie and the display-name field are removed; the
  middleware gates on the Supabase session instead.

### 5.4 Client library
Add `@supabase/supabase-js` (and `@supabase/ssr` for the Next.js session
cookies). This breaks the three-dependency rule for a stated reason: session
handling and token refresh are not "a few lines", and a hand-rolled version
is where auth bugs live. `CLAUDE.md` is updated to say so.

### 5.5 What changes in the app's data layer
`store.tsx` today layers browser-local overrides on the bundled
`recorded.ts`, saved as one whole snapshot. With several people writing, a
whole-snapshot save lets one auditor silently overwrite another's work, so:

- Supabase becomes the source of truth for contractors, audits,
  observations, actions, trail and settings.
- Writes are **per record** (upsert one audit, one observation), never a
  whole snapshot.
- `recorded.ts` stays, generated from the sheets, as the seed for the first
  load and the fixture the verifier and tests read. Pages no longer import
  it directly.
- The storage interface changes from snapshot load/save to record-level
  reads and writes. The conformance-suite idea is kept: the memory adapter
  and the Supabase adapter pass the same suite.

## 6. Getting the Excel data in

### 6.1 One reader
A single TypeScript module reads an audit workbook: blocks ten columns
apart, metadata in rows 1–2 (row 3 — auditor and phone — is never read),
area points in rows 8–25, observations from the `SR#` header row down. Rows
with no code but text are continuation lines and are joined to the
observation above. Photo cells and the "Evidence (Photo)" column are
ignored. The same module serves the first load (run from a script) and the
admin's in-app import (a server route). It uses Node's built-in `zlib` and an
XML parser over the sheet XML; no spreadsheet library is added.

The existing Python verifier (`scripts/verify-against-sheet.py`) stays as
the independent second reader: the import must agree with it cell for cell,
or it does not load.

### 6.2 First load (done once, by Claude)
1. Read `HS_AUDIT_FINDINGS.xlsx` (19 audits, Q4 2025 and Q1 2026) and the
   AL FAHD 1272 review (Q3 2026, 81 answered questions).
2. Remove names (§6.3).
3. Categorise every gap observation into the seven causes; positives get
   `GOOD`. While reading each observation for its cause, also flag any name
   the patterns missed.
4. Write the result to `data/observations-2025Q4-2026Q3.json` (outside
   `src/`, like the existing import record).
5. Run the verifier; load into Supabase with the service key.
6. Report: counts per audit (sheet vs loaded), names removed, observations
   needing a cause.

### 6.3 Name removal
- Patterns: a title (`Mr`, `Mrs`, `Ms`, `Miss`, `Eng`, `Engr`, `Dr`) followed
  by capitalised words → "a worker"; any text in row 3 of a block is never
  read.
- The categorisation pass (§6.2 step 3) is a second, human-like read for
  untitled names.
- After loading, a scan of every observation for the patterns must return
  zero matches. The same patterns power the auditor's name guard (§4.3).

### 6.4 Future quarters
- **Auditors enter directly** on the report page (§4.3), or
- **the admin imports a sheet**: upload → the server reads it (§6.1) → a
  preview lists every audit with its points and observation counts and any
  check that failed → save on approval. Imported observations arrive with no
  cause and show under "needs a cause".

## 7. Operations
- **Keep-alive:** a daily Vercel cron calls `/api/health`, which runs one
  trivial query, so the free project is never paused for inactivity.
- **Backups:** a nightly GitHub Action exports the database and keeps it as a
  workflow artifact (90-day retention). The sheets remain the backstop for
  everything imported.
- **Environment:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (Vercel and local); `SUPABASE_SERVICE_ROLE_KEY` (Vercel server and the
  seeding script only).
- **Network:** this cloud workspace must be able to reach the project's
  `*.supabase.co` host; verify on day one and open it in the environment's
  network settings if blocked.
- **Owner action needed:** create the Supabase project (sign up with GitHub,
  any region), then provide the URL, anon key and service-role key as
  secrets, not in chat.

## 8. Compliance
`docs/COMPLIANCE-KSA.md` is updated in the same change as the schema:
- §2 and §4: observation text is now held, with names removed by rule and by
  review; four role accounts exist whose emails are placeholders, not
  personal addresses.
- §5.5: record the role accounts, the opaque account id in the trail, and
  set a retention period for audit records (proposed: 7 years; confirm with
  NEOM's retention schedule).
- `CLAUDE.md` invariant 2 ("no free text") is rewritten to the new rule:
  free text exists only in `observations.text`, and only after the name
  guard.

## 9. Testing
- Scoring tests and fixtures unchanged (`scoring.ts` and `checklist.ts` are
  not touched).
- Reader: per-block counts match the verifier for every block of both
  workbooks; continuation lines joined; photo cells skipped; row 3 never
  read.
- Name removal: a fixture of known patterns is removed; the post-load scan
  is a test.
- RLS: a test per role per table (viewer cannot write; auditor cannot touch
  contractors; anonymous reads nothing), against a local Supabase.
- UI: `scripts/check-ui.mjs` (320 px, console errors, print contrast) and
  the screen-to-sheet chain (`scripts/audit-chain.py --screen`) pass.

## 10. Phases
Each phase gets its own implementation plan and ships on its own.

1. **Data in** — reader, name removal, categorisation, observations in the
   dataset; Observations tab on the existing local store. (Visible value
   before the database exists.) Until phase 2, the de-identified text ships
   in the app bundle exactly as the scores do today, so it is readable by
   anyone who can open the app; phase 2 moves all of it behind the login.
2. **Supabase** — schema, RLS, accounts, login, record-level store, seed,
   keep-alive, backup.
3. **Structure** — the four tabs, merged screens, navigation rule.
4. **Board** — split card, causes, weakest areas, motion and hover.
5. **Auditor** — report-page entry of observations with causes and the name
   guard, admin Excel import.

## 11. Out of scope
Photographs; the other four disciplines' checklists (unchanged:
`sections: []` until someone supplies them); notifications; a light theme;
mobile apps.
