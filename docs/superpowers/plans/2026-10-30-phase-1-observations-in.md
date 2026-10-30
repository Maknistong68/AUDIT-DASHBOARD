# Phase 1 — Observations In: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every observation in the audit workbooks into the app, with
names removed and causes assigned, plus the Q3 2026 AL FAHD audit with its 81
answers, and give it a searchable, filterable Observations tab.

**Architecture:** The existing, verified Python import path is extended
instead of replaced: `import-hs-audit.py`'s block geometry is reused by a new
observations extractor, a second independent script cross-checks it, and
`build-recorded-dataset.py` generates a second module,
`recorded-observations.ts`, beside `recorded.ts`. The app reads it through
the existing store, which gains one override (edited causes). One shared JSON
file holds the name patterns for Python and TypeScript.

**Tech Stack:** Python 3 + openpyxl (scripts, read-only), TypeScript, Next.js
15, Vitest. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-30-ehss-platform-redesign-design.md`
(phase 1 of §10; §4.4, §6.2, §6.3, §8).

## Global Constraints

- No new runtime dependency (`package.json` dependencies stay next, react, react-dom).
- Do not touch `src/lib/ehss/checklist.ts` or `src/lib/ehss/scoring.ts`.
- Never re-save a source workbook (openpyxl drops its 28 photos); open with `read_only=True, data_only=True` only.
- Never read row 3 of any block (auditor names, phone numbers).
- Contractors stay `initials (last 3 of work order)`; no full work order reaches `src/`.
- Photographs and the "Evidence (Photo)" column are never imported.
- Name replacement text is exactly `a worker`.
- Causes are the seven codes `DOC PLN IMP CMP SUP RES LED` plus `GOOD`; positives carry `GOOD` only.
- Existing colours, tokens and components only; no new palette (spec D8). Labels on marks, no explanatory sentences (D10).
- Source workbooks live outside the repo; scripts take their paths as arguments. In this session: `/root/.claude/uploads/57d36f44-be71-5d69-9b2e-e37b663540ed/41dccfbb-HS_AUDIT_FINDINGS.xlsx` (findings) and `/root/.claude/uploads/57d36f44-be71-5d69-9b2e-e37b663540ed/d153ee82-Excellence_EHSS_Quarterly_Performance_Review_-_AL_FAHD_1272-_Health__Safety_Rev.xlsx` (review).
- Gates before every push: `npm run build`, `npm test`, `node scripts/check-ui.mjs` (with the app running).

## Review Focus

1. **An observation typed over several rows** must come in as ONE observation with its lines joined, not as fragments with no question code. → Task 2 step 3 asserts no `gap` row has a null code where the block's previous row had one, and the cross-check count (Task 2) counts joined observations.
2. **A name with no title** ("Mahmoud was operating…") is invisible to the patterns. → Task 4's categorisation pass returns a `nameFlag` per observation; every flagged one is rewritten before Task 5 builds, and Task 5's test fails if any `nameReview` is still `"flagged"`.
3. **A search containing regex characters or odd spacing** (`permit (PTW)`, `  B6 `, `a+b`) must not throw and must match literally. → Task 7 test `searches literally`.
4. **A browser holding a snapshot from before this change** (no `observationCauses` field) must load cleanly. → Task 6 adds the case to the conformance suite.
5. **A link or bookmark with an unknown filter value** (`?cause=XYZ&quarter=1999-Q9`) must ignore the bad value, not empty the page or crash. → Task 7 test `ignores unknown filter values`.

---

### Task 1: Name patterns, shared by Python and TypeScript

**Files:**
- Create: `src/lib/ehss/name-patterns.json`
- Create: `src/lib/ehss/names.ts`
- Test: `src/lib/ehss/names.test.ts`

**Interfaces:**
- Produces: `name-patterns.json` = `{ "titles": ["Mr","Mrs","Ms","Miss","Eng","Engr","Dr"], "replacement": "a worker" }`.
- Produces: `findNames(text: string): string[]` — each matched span (title + following capitalised words, optional `.` after the title).
- Produces: `removeNames(text: string): { text: string; removed: number }`.

- [ ] **Step 1: Write the failing tests**

```ts
test("finds a titled name", () => {
  expect(findNames("an untrained worker (Mr. Mahmoud Ahmed) was operating")).toEqual(["Mr. Mahmoud Ahmed"]);
});
test("replaces it with 'a worker'", () => {
  expect(removeNames("Observed that Eng Khalid Omar signed the permit")).toEqual({ text: "Observed that a worker signed the permit", removed: 1 });
});
test("leaves ordinary text alone", () => {
  for (const s of ["Mrs. is not a name here", "Dr. pepper", "MEWP operator", "Mr", "ms excel"])
    expect(findNames(s)).toEqual([]);
});
test("is case-sensitive on the name, not the title", () => {
  expect(findNames("MR. Ali Hassan")).toEqual(["MR. Ali Hassan"]);
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/ehss/names.test.ts` — expect FAIL (module not found).
- [ ] **Step 3: Implement** `names.ts`. Build one RegExp from the JSON: title (case-insensitive) + optional `.` + one or more `\s+[A-Z][a-z]+` words, matched as whole words. A lone title, or a title followed by a lowercase word, does not match.
- [ ] **Step 4: Run** the test — expect PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add the name patterns shared by the importer and the app"`

### Task 2: Extract observations from the workbooks

**Files:**
- Create: `scripts/import-observations.py`
- Create: `scripts/verify-observations.py`
- Create: `data/observations-raw.json` (generated)

**Interfaces:**
- Consumes: `src/lib/ehss/name-patterns.json` (Task 1).
- Produces: `data/observations-raw.json`:

```json
{
  "sources": ["HS_AUDIT_FINDINGS.xlsx", "Excellence_EHSS_..._Rev.xlsx"],
  "blocks": [{ "quarter": "2025-Q4", "project": "4800001134-ABYATONA", "sheet": "Q4 2025 SUBREGION1", "column": "A", "count": 0 }],
  "observations": [{
    "id": "2025-Q4|4800001134-ABYATONA|001",
    "quarter": "2025-Q4", "project": "4800001134-ABYATONA",
    "sheet": "Q4 2025 SUBREGION1", "column": "A", "row": 52,
    "kind": "gap", "questionCode": "A1", "text": "…", "namesRemoved": 0
  }]
}
```

- [ ] **Step 1: Write `import-observations.py <findings.xlsx> <review.xlsx>`** printing the JSON above to stdout and a per-block summary to stderr. Rules:
  - Blocks: findings sheets as `import-hs-audit.py` finds them (`BLOCK_STRIDE = 10`, `Project:` in row 1); the review workbook is one block on sheet `Health & Safety` with its project in `D2` and date in `H2`. Quarter from the block's date (`2026-07-19` → `2026-Q3`).
  - Never read row 3 of a block (rows 3 and 4 in the review sheet: `B4`/`H4` are auditor and phone).
  - Locate the observation table by the cell whose text starts with `SR` in the block's first column, searching down from row 30. Columns relative to that cell: code `+0`, note `+1`, comment `+5`; `+6` (evidence/photo) is never read.
  - `kind`: note starts with `Positive` (any case) → `positive`; note contains `Site` → `site`; otherwise `gap`.
  - `questionCode`: the code cell if it matches `^[ABC]\d+(\.\d+)?$`, else `null`.
  - A row with no code, no note and a comment is a continuation: append to the previous observation's text with a newline.
  - A row whose comment is empty, `#VALUE!`, `#REF!` or only whitespace adds nothing.
  - Apply the name patterns from `name-patterns.json` to `text`; record the count in `namesRemoved`.
  - `id`: `quarter|project|NNN` numbered in sheet order within the block.
- [ ] **Step 2: Write `verify-observations.py <findings.xlsx> <review.xlsx> data/observations-raw.json`** — an independent second reader. It finds each block's table by searching every cell for the label `Observation/Comment` (not by offset from `SR#`), counts observations by the same continuation rule, and exits non-zero naming the block when its count differs from the JSON's `blocks[].count`. It also exits non-zero if any `text` still matches the name patterns.
- [ ] **Step 3: Run both**

```bash
python3 -I scripts/import-observations.py "$FINDINGS" "$REVIEW" > data/observations-raw.json
python3 -I scripts/verify-observations.py "$FINDINGS" "$REVIEW" data/observations-raw.json
```

Expected: 21 blocks (20 findings blocks + 1 review block), verifier prints `PASS`. Then prove it bites: change one block's `count` in a copy of the JSON and confirm the verifier fails on that block.
- [ ] **Step 4: Commit** the two scripts and `data/observations-raw.json` — `git commit -m "Extract every observation from the audit workbooks, names removed"`

### Task 3: Import the Q3 2026 AL FAHD review

**Files:**
- Create: `scripts/import-review-audit.py`
- Create: `data/hs-audits-2026Q3.json` (generated)
- Modify: `scripts/build-recorded-dataset.py` (accept several import records)
- Modify: `src/lib/ehss/recorded.ts` (regenerated)
- Test: `src/lib/ehss/recorded.test.ts`

**Interfaces:**
- Produces: `data/hs-audits-2026Q3.json` in the same shape as `data/hs-audits-2025Q4-2026Q1.json`, plus `"answers": { "A1": "partial", … }` per audit (`full|partial|no|na`; sheet `YES`→full, `NO`→no as in `Sheet6`).
- Produces: `build-recorded-dataset.py RECORD [RECORD…]`; an audit with `answers` gets `responses` (`issues: []` until Task 5 fills them).

- [ ] **Step 1: Write the failing test** in `recorded.test.ts`:

```ts
test("the Q3 2026 AL FAHD review carries the workbook's own answers", () => {
  const a = audits.find((x) => x.id === "af272-2026-Q3")!;
  expect(Object.fromEntries(Object.entries(a.responses).map(([k, r]) => [k, r.answer]))).toEqual(WORKBOOK_FIXTURE_ANSWERS);
});
```

and update the pinned totals: 20 audits, 3 quarters, 13 contractors.
- [ ] **Step 2: Run** `npx vitest run src/lib/ehss/recorded.test.ts` — expect FAIL.
- [ ] **Step 3: Write `import-review-audit.py <review.xlsx>`**: metadata from `D2` (project), `H2` (date), `H3` (inspection no.), sub-region from `D3` (`Sub Region 2` → `sr2`); answers from Part 1 (code in column B, answer in column J, rows 9–109, skipping sub-section header rows); area points from Part 2 rows 120–136 (columns H and I). Then extend `build-recorded-dataset.py` to take several records and run:

```bash
python3 -I scripts/import-review-audit.py "$REVIEW" > data/hs-audits-2026Q3.json
python3 -I scripts/build-recorded-dataset.py data/hs-audits-2025Q4-2026Q1.json data/hs-audits-2026Q3.json > src/lib/ehss/recorded.ts
```

- [ ] **Step 4: Run** `npm test` — expect PASS, including `scoring.test.ts` and `calculation.test.ts` unchanged. Run `python3 -I scripts/verify-against-sheet.py "$FINDINGS" src/lib/ehss/recorded.ts` — expect PASS (it checks the 19 findings audits; the Q3 audit is pinned by the test above).
- [ ] **Step 5: Commit** — `git commit -m "Import the Q3 2026 AL FAHD review with its 81 answers"`

### Task 4: Assign causes (Claude's first pass)

**Files:**
- Create: `data/observations-2025Q4-2026Q3.json` (generated)
- Create: `scripts/check-observations.py`

**Interfaces:**
- Consumes: `data/observations-raw.json` (Task 2).
- Produces: `data/observations-2025Q4-2026Q3.json` — the raw file with, per observation, `"causes": ["DOC", …]`, `"causesSource": "claude"`, `"nameReview": "clean" | "rewritten"`.

- [ ] **Step 1: Write `check-observations.py data/observations-2025Q4-2026Q3.json`**, exiting non-zero when: a `gap` or `site` observation has no cause; any cause is outside the seven codes; a `positive` has anything but `["GOOD"]`; a `gap` carries `GOOD`; any `nameReview` is not `clean`/`rewritten`; any text matches the name patterns; ids are not unique; the observation count differs from the raw file. Run it on the raw file — expect FAIL (no causes yet).
- [ ] **Step 2: Categorise in batches of 150.** For each batch, a subagent receives the seven category definitions from `src/lib/ehss/issues.ts` (label, description, owner) and the batch (id, kind, questionCode, text) and returns `{ id: { causes: [...], nameFlag: boolean } }`. Rules given to it: one to three causes per gap, the cause is WHY the requirement was not met and never WHERE (spec: "a category is a cause, never a place"); positives are `GOOD`; `nameFlag` is true when the text still names or identifies a person.
- [ ] **Step 3: Rewrite every flagged text** by hand so it names no one (replace the name with `a worker`, or the role), set `nameReview: "rewritten"`; the rest are `clean`. List the rewritten ids in the commit message body.
- [ ] **Step 4: Run** `python3 -I scripts/check-observations.py data/observations-2025Q4-2026Q3.json` — expect PASS. Print the cause distribution and spot-check 20 random observations against their causes.
- [ ] **Step 5: Commit** — `git commit -m "Assign first-pass causes to every observation"`

### Task 5: Observations in the dataset

**Files:**
- Modify: `scripts/build-recorded-dataset.py` (third input; second output)
- Create: `src/lib/ehss/recorded-observations.ts` (generated)
- Modify: `src/lib/ehss/model.ts`
- Modify: `src/lib/ehss/recorded.ts` (regenerated: Q3 `responses[].issues` filled)
- Test: `src/lib/ehss/recorded-observations.test.ts`

**Interfaces:**
- Produces in `model.ts`:

```ts
export type ObservationKind = "gap" | "positive" | "site";
export interface RecordedObservation {
  id: string;            // "af272-2026-Q3:014"
  auditId: string;       // an id in recorded.ts `audits`
  kind: ObservationKind;
  questionCode: string | null;
  text: string;
  causes: IssueCode[];
  causesSource: "claude" | "auditor";
}
```

- Produces: `export const recordedObservations: RecordedObservation[]` in `recorded-observations.ts`, joined to audit ids with the same `(quarter, project)` → contractor mapping and the same `DUPLICATES` drop that `recorded.ts` uses.
- Produces: Q3 2026 `responses[code].issues` = the union of causes of that question's gap observations (`["GOOD"]` for Full answers with a positive one, `[]` for N/A).

- [ ] **Step 1: Write the failing tests** in `recorded-observations.test.ts`:
  - every `auditId` exists in `audits`;
  - `findNames(o.text)` is empty for every observation (the post-load scan, spec §6.3);
  - every cause is in `ISSUE_BY_CODE`; positives are exactly `["GOOD"]`;
  - per-audit counts equal the counts in `data/observations-2025Q4-2026Q3.json` minus the dropped duplicate block;
  - every Partial/No answer in `af272-2026-Q3` has at least one gap cause in `issues`;
  - `src/app` imports `recorded-observations` only through the store (extend the existing no-fixture-import check in `recorded.test.ts`).
- [ ] **Step 2: Run** them — expect FAIL.
- [ ] **Step 3: Extend the build script** (`build-recorded-dataset.py RECORD… --observations data/observations-2025Q4-2026Q3.json --observations-out src/lib/ehss/recorded-observations.ts`) and regenerate both modules. Report dropped observations on stderr.
- [ ] **Step 4: Run** `npm test` and `npm run build` — expect PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add the observation log to the dataset"`

### Task 6: Store — observations and edited causes

**Files:**
- Modify: `src/lib/ehss/storage/adapter.ts`, `src/lib/ehss/storage/adapter.test.ts`
- Modify: `src/lib/ehss/store.tsx`
- Modify: `src/lib/ehss/trail.ts` (one new event kind)

**Interfaces:**
- Consumes: `recordedObservations` (Task 5).
- Produces: `OverridesSnapshot.observationCauses: Record<string, IssueCode[]>` (default `{}` in `EMPTY_OVERRIDES` and `normalize`).
- Produces on `useEhss()`: `observations: RecordedObservation[]` (recorded merged with overrides; an overridden one has `causesSource: "auditor"`) and `setObservationCauses(id: string, causes: IssueCode[]): void` — a no-op when the store's existing `canWrite` is false (the viewer role), logged to the trail as `observation.causes` with before/after.

- [ ] **Step 1: Write the failing tests**: conformance suite — a snapshot with no `observationCauses` key normalizes to `{}`; a store test — `setObservationCauses` changes the merged observation and its `causesSource`, and does nothing for a viewer.
- [ ] **Step 2: Run** `npx vitest run src/lib/ehss/storage` — expect FAIL.
- [ ] **Step 3: Implement**, through the store's single `update()` as every other mutation does.
- [ ] **Step 4: Run** `npm test` — expect PASS.
- [ ] **Step 5: Commit** — `git commit -m "Let auditors correct an observation's causes"`

### Task 7: Search and filter

**Files:**
- Create: `src/lib/ehss/observation-log.ts`
- Test: `src/lib/ehss/observation-log.test.ts`

**Interfaces:**
- Produces:

```ts
export interface LogFilter {
  q: string; quarter?: string; subRegionId?: string; contractorId?: string;
  area?: string;            // checklist area code: "A", "B1".."B12", "C1", "C2"
  cause?: IssueCode; kind?: ObservationKind; needsCause?: boolean;
}
export interface LogRow extends RecordedObservation { quarter: string; contractorId: string; contractorName: string; subRegionId: string; area: string | null }
export function toLogRows(observations: RecordedObservation[], summaries: AuditSummary[]): LogRow[];
export function filterLog(rows: LogRow[], f: LogFilter): LogRow[];
export function causeCounts(rows: LogRow[]): { code: IssueCode; count: number }[]; // the seven gap causes, fixed order, zeros kept
export function parseLogFilter(params: URLSearchParams): LogFilter;
export function logFilterToParams(f: LogFilter): URLSearchParams;
```

- Search: every whitespace-separated term must appear (case-insensitive, literal) in the text, question code or contractor name. `area` is derived from `questionCode` the way `checklistAreas()` groups it (A-questions → `A`).

- [ ] **Step 1: Write the failing tests**: `searches literally` (`"permit (PTW)"`, `"a+b"`, `"  B6 "` do not throw and match literally); `all terms must match`; each filter narrows; `needsCause` returns only gap/site rows with no causes; `causeCounts` keeps zeros in fixed order; `parseLogFilter` → `logFilterToParams` round-trips; `ignores unknown filter values` (`?cause=XYZ&quarter=1999-Q9&kind=foo` parses to `{ q: "" }`).
- [ ] **Step 2: Run** — expect FAIL. **Step 3: Implement.** **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** — `git commit -m "Search and filter the observation log"`

### Task 8: The Observations tab

**Files:**
- Create: `src/app/observations/page.tsx`, `src/app/observations/ObservationsClient.tsx`
- Modify: `src/components/NavBar.tsx` (the Findings item becomes `Observations` → `/observations`; `isCurrent` covers `/observations`, `/findings`, `/checklist`)
- Modify: `src/components/AnalysisTabs.tsx` (tabs: `Log` → `/observations`, `Areas` → `/findings`, `Checklist` → `/checklist`)
- Modify: `src/app/globals.css` (rules for the log only; delete nothing)

**Interfaces:**
- Consumes: `useEhss().observations`, `setObservationCauses` (Task 6) and the store's existing `audits`, `contractors`, `subRegions`, `canWrite`, `hydrated`; summaries via the existing `summarizeAll(audits, contractors, subRegions)` from `summaries.ts`, as other pages do; `toLogRows`, `filterLog`, `causeCounts`, `parseLogFilter`, `logFilterToParams` (Task 7); `ISSUE_CATEGORIES`.

- [ ] **Step 1: Build the page** top to bottom:
  1. One row: search input (`id="log-q"`, placeholder `Search observations`), then selects for quarter, sub-region, contractor, area, cause, kind, and a `Needs a cause` toggle. On a phone the selects wrap; the row never scrolls the page sideways.
  2. The match count as a number, then one horizontal bar per gap cause (`causeCounts`), label on the bar, count at its end; clicking a bar sets `cause`.
  3. The list, 50 per page: contractor, quarter, question code, a kind badge, the text clamped to two lines (click to expand), cause chips (toggles when `canWrite`, via `setObservationCauses`; read-only chips otherwise), and a link `Open report` → `/audits/[auditId]`.
  4. Filter state is read from and written to the URL (`router.replace`, no scroll jump).
  Rows wait for `hydrated` before rendering edited causes, as the audit page does.
- [ ] **Step 2: Verify in the browser** (`npm run dev`): searching `permit` narrows the list; `?cause=DOC` opens filtered; editing a cause as auditor persists across reload; a viewer sees no toggles.
- [ ] **Step 3: Run the gates**: `npm run build`, `npm test`, `node scripts/check-ui.mjs` — expect all PASS (no sideways scroll at 320 px, no console errors, print contrast).
- [ ] **Step 4: Commit** — `git commit -m "Add the Observations tab: search, filters, causes"`

### Task 9: Documentation and compliance

**Files:**
- Modify: `CLAUDE.md`, `docs/COMPLIANCE-KSA.md`, `docs/IMPORT-2025Q4-2026Q1.md`, `docs/superpowers/specs/2026-10-30-ehss-platform-redesign-design.md`

- [ ] **Step 1: Edit**:
  - `CLAUDE.md`: invariant 2 now reads that free text exists only in observation text, imported with names removed by `names.ts` and reviewed; the dataset is now 20 audits over 3 quarters plus `recorded-observations.ts`; the Observations tab and the `Log | Areas | Checklist` tabs; the four new scripts and the order to run them.
  - `COMPLIANCE-KSA.md` §2 and §4: observation text is held, de-identified by rule and by review, with the date of the owner's decision (2026-10-30); until phase 2 it ships in the app bundle like the scores.
  - `IMPORT-2025Q4-2026Q1.md`: an "Observations" section with the block counts and the names-removed count from Task 2.
- [ ] **Step 2: Run** `npm run build` and `npm test` — expect PASS.
- [ ] **Step 3: Commit and push** — `git commit -m "Record the observation log in the project docs"`, then `git push -u origin claude/stoic-bell-yq7r3g`.
