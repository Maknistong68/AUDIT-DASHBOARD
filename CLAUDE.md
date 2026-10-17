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

**Five audits, and EIGHTEEN checklists.** One audit per scorecard
discipline — H&S, Critical Risk Control, Environment, Security, Worker
Welfare — and Critical Risk is itself a focus inspection made of
**fourteen separate hazard checklists**, one per entry in the CRC register,
combined into the discipline score (owner, 2026-10-17). So the unit the app
models is the CHECKLIST, not the discipline and not the question:
`src/lib/ehss/scopes.ts` is the registry of all eighteen.

Only H&S has content (81 questions). The other seventeen are declared with
`sections: []` and the discipline or hazard they score carries a recorded
number until someone supplies the real questions. **Do not invent them** —
a checklist nobody wrote is worse than a blank one, because a blank one is
obviously blank. Adding Environment should be adding its sections to
`scopes.ts` and nothing else: the roll-up above a scope and the
question/answer/cause machinery below it are already written and already
tested. Anything built for H&S should stay that way — the issue taxonomy,
the recurrence model and the analytics are all discipline-agnostic by
design.

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

   **The H&S precedence chain, in order:** a recorded `disciplineScores.hs`
   → the checklist **answers** → the imported **area points**. Answers beat
   area points because the points are a coarse stand-in for an audit nobody
   recorded question by question: once someone answers the checklist, that is
   the audit, and a score that refused to move would be silently wrong toward
   the old number.

   **That second step is decided PER AREA, not per audit.** An area scores
   from its questions once all of them are answered, and from its recorded
   points until then; an area with neither drops out of the mean. It was per
   audit, and that was destructive in both directions — one answer on an
   imported review switched the whole thing to the checklist and dropped the
   other fourteen areas of real recorded points out of the total, while the
   opposite ordering shows an auditor last quarter's number as they fill this
   quarter's in. ALL answered rather than SOME, because a recorded area is a
   complete figure and three answers out of eight is not one. The formula is
   untouched: this chooses each area's SOURCE, and the roll-up above it is
   the same arithmetic either way. `scoreAreasAndAnswers()` carries the rule,
   `scoreChecklist()` is the only caller a page should use, and
   `areaSource()` is how the entry screen SAYS which source an area is on —
   a score that changes hands silently is the bug this replaces.

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
  **Two entry points, one aggregation**: `scoreAudit` from answers,
  `scoreRecordedAreas` from an imported audit's area points, both through the
  shared `aggregate` — the same formula at two grains — and
  `scoreAreasAndAnswers` for a review that holds both, choosing per area (see
  the precedence chain above). `scoreChecklist(audit)` in `summaries.ts` is
  the only thing a page should call: one that reaches for `scoreAudit`
  directly will read every imported audit as unscored.
- **`scoring.test.ts`** — pins the engine to the workbook's real numbers
  (A 46.94, B 74.60, C 61, total 60.85). If scoring changes, these
  fixtures are the contract — update only with a matching workbook change.
- **`recorded.ts`** — GENERATED, and **the app's only dataset**: the real
  Health & Safety audits for Q4 2025 and Q1 2026 (13 contractors, 19 audits,
  2 sub-regions). There is no demo data in the app. Regenerate with
  `python3 scripts/build-recorded-dataset.py data/hs-audits-2025Q4-2026Q1.json
  > src/lib/ehss/recorded.ts`; `docs/IMPORT-2025Q4-2026Q1.md` is the import
  record and `data/` holds the source JSON, deliberately outside `src/` so the
  full work orders are not bundled into the client.
  - **Contractors are initials + the last three digits of the work order** —
    `SIBS (838)`, `AF (272)` — and nothing else reaches the app. That is a
    compliance position as much as a display choice: §4 of
    `COMPLIANCE-KSA.md` lets this data live outside the Kingdom *because it
    identifies nobody and nothing*, and it also settles the source sheet's
    three spellings of SIBS by construction. Do not widen `name` or `code`
    back out to full names or full work orders.
  - Each audit carries **`areaScores`** (the 15 checklist areas as raw
    points) and **no `responses`**: the source sheets kept a narrative per
    question with no machine-readable answer, so there is nothing honest to
    put in them. `possible` varies per audit because N/A questions drop out
    of it, which is the workbook's own rule, so it is stored per audit rather
    than taken from the checklist's nominal weights.
  - **The score is calculated from the points, always.** `reportedTotal` is
    the percentage the source sheet stated, and it is **not a record**
    (owner's instruction, 2026-10-07): its formula disagrees with its own
    points columns in 18 of the 19 audits, nine of them overstating by up to
    14.2 points. So it is never a fallback, never an alternative figure and
    never flagged as an error — it survives as one muted line of provenance
    on the audit page, for whoever is holding last quarter's report and
    wonders why the number moved. Do not reintroduce it as a comparison.
  - **The dataset is verified against the workbook itself**, not just against
    the import record: `scripts/verify-against-sheet.py <workbook>
    src/lib/ehss/recorded.ts` re-reads the xlsx by searching for the sheet's
    own labels ("Project:", "Total Possible Points", each area's printed
    title) where the importer uses fixed row offsets. Two different ways of
    reading one file, required to agree, so a shifted row in next quarter's
    template fails loudly instead of importing the wrong cells. Run it on
    every new quarter. Last run (2026-10-10): PASS — 279 area cells and 76
    metadata fields identical, the one 21.5/21 score capped as designed.
    It also fails on an undeclared duplicate block, which is how the PPCO
    row pasted under SIBS was caught.
  - **The entry template is `templates/HS-AUDIT-TEMPLATE.xlsx`**, generated
    by `scripts/build-audit-template.py`, and it is the fix for the source
    sheets having no formulas. It keeps the exact geometry the importer reads
    (project in C1, date in G1, row 8 section A, rows 10-21 B1-B12, rows
    23-24 C1-C2, points in G and H, total in G25, blocks ten columns apart),
    and computes area, section, total and rating with the same rules as
    `scoring.ts` and `bands.ts` — so a quarter entered through it agrees with
    the dashboard by construction. Change the roll-up in one place and you
    must change it in the other; `scripts/build-audit-template.py` names the
    rule in a comment beside each formula, and
    `scripts/verify-template-formulas.py` is the check that they have not
    drifted — it reads the formulas back out of the .xlsx, evaluates them
    against a real audit's points and requires the figures to EQUAL the
    dashboard's, not merely come close. A tolerance would have accepted the
    drift it found: every level has to carry `ROUND(...,4)`, because
    `scoring.ts` rounds each area to two decimals before averaging, and
    averaging full-precision ratios instead put section C of ABYATONA (134)
    Q4 2025 at 53.02 against the app's 53.03. It cannot prove Excel PARSES
    the formulas — only opening the file or the xlsx skill's `recalc.py`
    does, and LibreOffice could not finish a recalculation in the cloud
    sandbox — so every function used is kept to the pre-2007 set.
    **Never re-save the populated source workbooks with openpyxl**: they hold
    28 embedded site photographs that it discards silently (10.6 MB -> 0.4 MB
    in a round-trip test, every image gone).
  - **The workbook contains no formulas** — every cell is a hardcoded number,
    so its percentages, section rows and totals do not recalculate and have
    drifted from its points. Section B and section C do not even use the same
    roll-up rule, and no rule explains the stated total in 11 of 20 blocks.
    Do not write code that reconciles to those figures; there is nothing
    consistent to reconcile to. The points are sound (all 40 section sums
    add up exactly) and are what the app scores.
  - **The whole chain is verified end to end, in one command.**
    `scripts/audit-chain.py` walks source record -> dataset -> independent
    longhand arithmetic -> **the rendered screen**, and exits non-zero naming
    the cell when any link disagrees. The fourth link is the one no unit test
    covers: `scripts/scrape-audit-pages.mjs` reads every audit page out of
    the running app, so "the dashboard is right" stops meaning "the dashboard
    agrees with itself". Last run 2026-10-17: 558 point cells and 361
    rendered figures, 0 disagreements. Run it with `--screen` and the app on
    :3000; Playwright is resolved at runtime from `PLAYWRIGHT_NODE_PATH` and
    must NOT become a dependency or be symlinked into `node_modules`.
    Prove it still bites after changing it: alter one point value and watch
    it fail. A check that cannot fail is not a check.
    `docs/DATA-ASSURANCE.md` is the director-facing write-up of that audit —
    where each number comes from, what was verified, and what is still
    weak.
  - **The calculation is cross-checked, not trusted.** `calculation.test.ts`
    re-derives every audit's areas, sections and total straight from the
    import record in `data/`, with the arithmetic written out longhand in the
    test — no checklist, no engine, no shared helper — and requires the two
    to agree exactly. It also pins that no score escapes 0–100, that no area
    is scored above its applicable weight (the sheet had one at 21.5/21; the
    importer caps it), that rounding at each level costs under 0.01 points,
    and that a blank area drops out of the mean rather than scoring zero.
    Keep the two implementations independent — the moment the test imports
    the thing it is checking, it stops checking anything.
- **`fixture.ts`** — the former `mock.ts`: synthetic, 11 contractors over four
  quarters, **tests only**. Nothing in `src/app` may import it. It exists
  because the question-level machinery (findings, issue categories,
  recurrence) still needs a dataset with answers to be tested against, and
  the real data has none. A number on a director's screen that nobody audited
  is worse than a blank.
- **`summaries.ts`** — derived, client-safe views: timeframe windows
  (`windowByContractor`, latest / last3 / last4 / all), `contractorStats`
  (the league table), `topIssues` (weighted points lost per question) and
  `areaTrends`, which carries the "no improvement across N reviews"
  judgement. Area trends average per quarter, so they work programme-wide as
  well as per contractor, and they cover all 15 checklist areas — section A
  included, which means `AuditSummary.subSections` promotes A's unnamed
  sub-section to the section's own code so it lines up with
  `checklistAreas()`. A was silently absent from the trends before, and it is
  the largest area in the checklist.

### App shell (Next.js 15 App Router)

- **No database yet, no auth.** Middleware gates on the `demo_profile`
  cookie set by `/welcome` (name + role); role only affects UI affordances.
  Analytics always exclude draft audits. The cookie keeps its old name
  because renaming it signs every open session out and it is shown nowhere;
  its module moved to `src/lib/session/`.
- **Nothing user-facing says "demo".** It used to: the welcome page
  advertised "built-in sample data — 11 contractors, four quarters", every
  header carried a `· demo` badge and a "Restart demo" button. All of that
  described the generated dataset that no longer exists, and the owner saw
  it and reasonably read the whole app as a mock (2026-10-14). The data is
  13 real contractors and 19 real audits; the copy says so. The localStorage
  key moved from `ehss-demo-v1` to `ehss-v2` in the same change, which
  deliberately orphans anything a browser still held from the demo era.
  Keep this straight: `fixture.ts` is the only invented data left and
  nothing in `src/app` may import it, which `recorded.test.ts` enforces.
- **`store.tsx` is the data layer.** `EhssStoreProvider` (mounted in the root
  layout) merges the `recorded.ts` baseline with user overrides persisted in
  `localStorage`: new reviews, edited answers, discipline scores, contractor
  activation. Pages read it through `useEhss()`, so most pages are client
  components; server pages only read the cookie and pass `role`/params down.
  State starts as the baseline so SSR matches the first client render —
  a page looking up a possibly user-created record must wait for `hydrated`
  before deciding it is missing.
- **The board is a BENTO of tiles over one quarter** (`/`, `DashboardClient`
  + `components/board/Bento.tsx`). Built to a reference the owner supplied
  (2026-10-17) and matched deliberately: a twelve-column grid, each tile its
  own rounded glass surface with one job and one scale. Top row — the
  programme trend, this quarter's contractors as columns, the latest
  reviews. Below — below target, weakest area, against target, the
  watchlist, recurring gaps, reviews, start a review. The spans are written
  out per tile (`.bn-trend`, `.bn-league`, …) rather than left to auto-flow,
  so a tile added later cannot silently reshuffle the row above it.
  Every tile that carries a corner arrow goes somewhere real; an arrow that
  opens nothing is the worst affordance on a dashboard.
  **It used to be "ONE chart" pinned to `100dvh`, and that rule was the bug.**
  Thirteen contractors in a viewport-tall chart can only be enormous, with
  everything else squeezed around them — the owner's words were "a bar chart
  that is so huge, and the rest is a little bit unproportioned" (2026-10-14).
  The lock is gone and the page scrolls like a page. Do not reintroduce a
  viewport-height dashboard.
- **The board reports the SCORECARD figure (`overall`), everywhere.** It
  used to be split: the columns, watchlist, sub-region averages and KPI row
  read `AuditSummary.total` (the H&S checklist total) while the trend read
  `overall`. They are the same number while H&S is the only discipline
  scored, which is why it read as correct — record one Environment score,
  which the editable audit page now permits, and the board would have
  disagreed with its own trend line about the same contractor in the same
  quarter. `board.test.ts` pins it on a summary carrying a second
  discipline, because a test on the real data cannot tell the two apart.
- **The board says which disciplines the headline covers.**
  `weightedOverall` renormalizes over whatever is scored, which is right and
  is also how a board misleads: with H&S alone the weights collapse onto it
  and a contractor's "overall" IS their H&S score, under a heading that says
  EHSS. `scoredDisciplines()` is how a view knows, and the subtitle says
  "Health & Safety only — 60% of the scorecard is not yet scored" until a
  second discipline is recorded. Don't remove it; remove the condition when
  the other four arrive.
- **The two board charts.** `ProgrammeTrendChart` plots TWO means over the
  fan of every contractor's own path. **Like for like** (accent, with the
  wash) is the contractors audited in every quarter on record — the only
  line whose movement is the programme moving. **All reviews** (`--series-2`)
  is whoever was audited that quarter. They are not the same story: between
  Q4 2025 and Q1 2026 the all-reviews mean falls 5.85 points but only 2.14
  of that is the programme; 3.71 is the five contractors who joined, who
  average 58.4. Drawing only the second showed a decline nearly three times
  the real one, and disagreed with the KPI delta, which has always been
  like-for-like. Two series, so the legend is not optional — it is rendered
  from the same values that drew the lines. The fan is one recessive ink and
  claims no identity. The y axis is FITTED to the data and snapped to a
  round step: pinned to 0–100, two quarters of real scores occupy a third of
  the plot and every movement flattens.
  `ScoreColumns` is the quarter's contractors, worst on the left, bars from
  zero, each printing its own score inside the bar. In both, the accent
  marks the one thing the board is currently about (the selected
  contractor, or the weakest) — colour follows the entity, never the rank,
  so changing the selection moves one mark and repaints nothing else.
  `programmeTrend` / `sectionMoves` / `recentReviews` in `summaries.ts` feed
  them, pinned in `board.test.ts`.
- **Three drill-down levels, and only the last one has words.**
  `ContractorView` is level one: the headline (score, band, change,
  sparkline), WHERE the gap is (section A/B/C under short names —
  Management, On site, Planning & leadership), WHY it is there (the seven
  categories), and whether it is STICKING. `AreaView` is level two: the
  detail, the questions the area asks, what the auditor recorded. A piece
  with nothing behind it is absent, so "why" is not drawn when no causes are
  on record, and "is it sticking" needs two reviews — with one, every gap
  would read as "new", which says more about how much history we hold than
  about the contractor.
- `contractorProblems()` / `problemEvidence()` / `problemPeer()` in
  `summaries.ts` are the drill-down model: a "problem" is a checklist area,
  a critical-risk hazard or a question, ranked by gap to target amplified
  when the trend is flat or declining. Every problem carries a 0–100
  `score`, questions included (the engine already scores an answer Full 100
  / Partial 50 / No 0), so every row in the drill-down reads the same way:
  how compliant, against the same target.
- **Three drill-down levels, and the first two are VISUAL.** Directors read
  shapes before sentences, so level 1 (`ContractorPanel`) and level 2
  (`ProblemOverview`) carry magnitude and direction and almost no prose —
  bullet bars against the 90% target, quarter columns, sparklines, cause
  bars (`charts/Marks.tsx` holds the shared marks). Level 3
  (`ProblemPanel`) is where words belong, because "what the auditor
  recorded" has no shape. Keep new drill-down work on that split; a
  sentence added to level 1 or 2 is a regression.
- Level 2 shows the quarter bars in the rail only when the main column has
  controls to list. A hazard or a single question has none, so the bars move
  across and become the main visual rather than being drawn twice.
- **Area-level recurrence is what the recorded data supports.**
  `stickyAreas()` is the owner's definition applied where it has real numbers
  behind it: an area below target in this review AND the one before it. The
  question-level machinery below still exists and is what runs once reviews
  carry answers, but the imported quarters hold area points only, so
  "this question came back" would have nothing behind it while "this area was
  weak again" has two real figures.
- **Recurrence** (`findingHistories()` and friends): the same question
  tracked answer-by-answer across a contractor's quarters. Two rules decide
  everything and are pinned in `recurrence.test.ts` — a finding is
  `recurring` at `RECURRING_THRESHOLD` (**2**) consecutive open reviews,
  which is the owner's own definition (2026-10-14): "it happened on the
  previous audit and it happened again to the next audit". It was 3, a
  defensible threshold and not this programme's; at 3 nothing in two
  quarters of data could ever qualify. And
  **N/A never closes a finding** ("not applicable this quarter" usually
  means the work was not running, which is not evidence anything was
  fixed; it breaks the streak without earning a closure). `reopened`
  outranks `recurring`: a fix that did not hold is worse than one never
  attempted. Surfaced as the movement strip and row flags in the
  drill-down and the "Findings across quarters" card on `/findings`.
- `fixture.ts` answers are **sticky** across quarters (most of each draw
  comes from the contractor-and-question pair, little from the quarter).
  Drawing each quarter independently made nearly every finding look reopened
  the next quarter and the recurrence view read as noise. Keep it sticky —
  the recurrence tests read as meaningless otherwise.
- **The audit page is five audits behind a tab strip** (`DisciplinePanels.tsx`).
  The scorecard at the top is the tab strip, not a grid of five number
  fields: a discipline is a place you go to run its audit, not a box you
  type a figure into. Each tab carries its weight, its score and WHERE that
  score came from — checklist, area points, hazards, or typed — because
  "72.3% somebody answered for" and "72.3% somebody typed" are different
  claims about the same number. H&S opens first; it has the checklist and
  40% of the scorecard.
  - **Critical Risk** is the fourteen hazards, each with its own checklist
    and its own in-scope decision. A hazard outside the contractor's scope
    of work is ABSENT from the mean, never a zero — scoring a firm with no
    marine works on Working on or Near Water would be a lie about the
    contractor rather than a fact about the work. A hazard's score comes
    from its checklist once that checklist is COMPLETE and from the
    recorded figure until then, which is the same all-or-nothing precedence
    the H&S form uses between its answers and its area points, for the same
    reason. `riskScore()` carries it; `crcScore()` is still the only
    definition of the discipline score.
  - **Environment / Security / Worker Welfare** show the recorded score,
    which is the real screen and not a placeholder — those audits happen
    and their numbers exist. Their checklist appears under it the moment
    `scopes.ts` carries their sections.
  - `components/audit/QuestionRow.tsx` holds the question row AND the answer
    reducers (what an answer does to the causes beside it). Shared on
    purpose: eighteen checklists must record the same kind of answer, and a
    second copy of that markup is how two of them end up disagreeing about
    what "Partial" means. `ChecklistForm.tsx` is the generic form every
    scope except H&S uses — H&S keeps its own screen because it alone
    carries imported area points, which is the complicated part of it.
  - Answers live in `audit.responses` for H&S and `audit.scopedResponses`
    keyed by scope id for everything else. H&S did NOT move: that field is
    what every view, the recurrence machinery and every record already saved
    in a browser use.
- **The audit page shows the whole checklist and every field is editable.**
  It used to show a read-only fifteen-row table for an imported review and
  the 81-question form only for a draft, so a mis-keyed point from a
  transcribed sheet had nowhere to be fixed. Now one screen carries the
  review's own details (quarter, date, inspection number, status), the
  discipline and critical-risk scores, and all 15 areas — each with its
  recorded points as inputs, its score, which of the two sources that score
  is coming from, and the questions it asks. Editing an approved review
  takes one deliberate "Edit this review"; a draft is open as before, and a
  viewer cannot edit either. Submission asks for what the review is actually
  missing rather than all 81 answers: an area already on record as points is
  complete at the grain it was audited, so only areas with no points need
  their questions answered.
  Every panel there seeds a `useState` from the audit, so they are keyed on
  `hydrated` — the store starts from the recorded baseline for SSR and
  applies the browser's saved edits a tick later, and without the key a panel
  keeps the baseline it was born with and a saved edit reads as lost on
  reload.
- **The entry form is the auditor's screen, and it is long by nature**: 81
  questions with a twelve-toggle cause picker on every gap runs to about
  thirteen screens. `EhssAuditForm` carries a sticky toolbar that answers
  the three questions that make it workable without scrolling — how far
  through (progress + live score), what blocks submission (the "N need a
  cause" chip, which is itself the shortcut to that filter), and where is
  area B6 (the jump strip, one chip per area with a dot for its state).
  The filter (All / To do / Gaps / No cause) is the main tool: it cuts the
  page from ~11,500px to ~5,100px when you only want what is left. Keep
  filter labels SHORT — a segmented control cannot shrink below its labels,
  and the long ones pushed a 320px phone sideways; it now scrolls rather
  than widens, but short labels are the real fix.
- **A view with no data behind it is ABSENT, not explained.** This screen is
  shown to directors. An empty card under a heading reads as an unfinished
  product, and a note explaining why it is empty reads as an excuse — the
  owner's words, 2026-10-11, on a paragraph that used to sit at drill-down
  level 3. There was a `RecordedOnlyNote` component for exactly that; it is
  deleted, and it should not come back.
  Every audit on record holds area points and no answers, so the gap
  register, the SHEW heat-map, the issue categories, per-question recurrence
  and the question rankings have nothing to show. Each of those now renders
  only with its own data, and `/findings` — where every card is
  question-level — carries one line pointing at the checklist tab instead of
  a page of empty headings and filters over nothing.
  Three rules follow, and they are all conditional rendering, never deletion,
  so everything returns by itself once reviews carry answers:
  1. **No dead ends.** Level 2 offers "See what the auditors recorded" only
     when `evidence.length > 0`. A button opening an empty panel is worse
     than no button.
  2. **No misleading zeros.** "0 gap observations" and "0 came back" read as
     a clean audit on contractors averaging 64.9%, so the tile and the
     movement strip are absent rather than zeroed. A dash is better than a
     zero but still invites the question the card cannot answer.
  3. **No unmeasurable rows.** Where no contractor is measured on a question,
     the level-2 control list is empty and the quarter bars take the main
     column, per the level-2 rule above.
  `AuditSummary.fromAreaScores` is how a view knows.
- **No future audits.** `quarterOptions()` offers the quarters on record plus
  the current and previous one, never the next: an audit for a quarter nobody
  has audited is a draft dated in the future. The auditor creates the review
  when there is something to record (owner's direction, 2026-10-14).
- **Do not touch `checklist.ts` or `scoring.ts`** without the owner saying
  so (2026-10-14: "don't change anything on the checklist, don't change any
  formulas"). Where the source sheet's own arithmetic disagrees with its
  points, the app keeps its formula and ignores the sheet's — that is settled
  and is not to be "fixed" by matching the sheet.
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
  which the checklist never says. **SEVEN** since 2026-10-14 (owner's
  direction), down from twelve: DOC, PLN, IMP, CMP, SUP, RES, LED, plus
  GOOD. Three rules hold the list together: every category implies a
  **different fix and a different owner** (merge any two that don't);
  **nothing is specific to one discipline**, so the same seven serve all five
  audits; and **a category is a CAUSE, never a PLACE**. That third rule is
  what cut it — `SUB` (subcontractor control) was a category *and* is
  checklist area B6, so a missing subcontractor assessment was filed as its
  own cause when it is a Documentation failure that happens to sit in B6.
  Keeping the axes apart lets a report say "our B6 problem is 70%
  documentation", which names the fix. `REC`→DOC, `INS`→SUP, `EQP`→RES,
  `COM`→LED, `TRN`→CMP, `SUB`→IMP in `LEGACY`, and `readIssues()` dedupes
  when two old codes fold into one. Seven is also the readable ceiling: past
  about seven classes carrying meaning, adjacent ones blur. They
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
- **The app is DARK, at every system setting.** One palette, not two: the
  look the owner asked for is dark with a lime accent, and a light variant
  of it would be a different product wearing the same layout. The
  `prefers-color-scheme` override that used to carry the dark steps is gone
  and `color-scheme: dark` is set so native controls follow. If a light
  theme is ever wanted back it is a new palette and a re-validation, not an
  un-comment.
- Design tokens live in `app/globals.css`, in two layers that must not be
  mixed: **semantic** tokens (`--ink-*`, `--accent`, `--band-*`,
  `--series-*`) carry meaning and are the validated palette; **material**
  tokens (`--mat-*`, `--shadow-*`, `--r-*`) carry depth only. `--surface-1`
  stays an opaque colour — SVG has no `backdrop-filter`, so chart rings and
  surface gaps need the composite the glass resolves to (`#20232a`). That is
  also the surface the palette is validated against; change the glass and
  you re-validate.
- The trend card is the one place TWO series are drawn, in `--accent` and
  `--series-2` (`#49b8f5`). Measured on `#20232a`: ΔE 29.8 protan, 19.4
  tritan, 31.3 normal — far above the 8/15 floors — and both clear 3:1
  against the surface. The dark lightness band (0.48–0.67) is the one check
  they fail, and deliberately: the lime is the owner's reference colour, it
  is 12.5:1, both lines carry a legend entry, and identity never rests on
  colour alone. Record a new exception here rather than quietly widening it.
- **`--accent` is lime (`#ccf45b`) and it is spoken for.** It marks the ONE
  thing a view is about and nothing else — never a decoration, never a
  second series. Text never sits on it in white (1.1:1); `--on-accent` is
  the ink that goes on an accent fill. The accent is 12.5:1 on the card
  surface and the five rating bands run 5.2–10.4:1 on it.
  The bands are a STATUS scale taken from the client's own scorecard legend,
  so neither the categorical nor the ordinal validator in the dataviz skill
  is the right test for them — they are not an identity palette and not a
  one-hue ramp. They always ship with the printed value and a labelled
  badge, and contrast against the surface is the check that applies. Do not
  "fix" them by running them through the categorical validator.
- The ambient wash (`body::before`) is an olive field, blurred, fixed. It is
  decoration and never a data channel. Its blobs are positioned inward
  because the layer overscans the viewport — centred at the edges they fall
  off-screen and the page reads as flat black.
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
