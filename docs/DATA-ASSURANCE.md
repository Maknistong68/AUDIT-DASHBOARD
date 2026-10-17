# Data assurance — the director's questions

*Audit run 2026-10-17 against commit `b951060` + the fixes it produced.
Every figure below was re-derived on the day, not quoted from an earlier
run. The commands are given so the exercise can be repeated by someone who
does not trust this page.*

This document exists to answer one thing: **if a number on this dashboard
is put in front of a contractor, what stands behind it.**

---

## 1. Where does a number come from?

Five links, each one checkable on its own.

| # | Link | What it is | Can it be checked? |
|---|---|---|---|
| 1 | The source workbook | `HS_AUDIT_FINDINGS.xlsx` — the auditors' own sheets | Yes — `scripts/verify-against-sheet.py` re-reads the xlsx a second, different way |
| 2 | The import record | `data/hs-audits-2025Q4-2026Q1.json` — what the importer read out | Yes — it is plain JSON, in the repository, readable without this app |
| 3 | The dataset | `src/lib/ehss/recorded.ts` — generated from (2) | Yes — 558 point cells compared today, 0 differ |
| 4 | The engine | `src/lib/ehss/scoring.ts` — the workbook's formula | Yes — `calculation.test.ts` re-derives every audit longhand, independently |
| 5 | The screen | what a director actually reads | Yes — 361 rendered figures scraped and compared today, 0 differ |

**There is nothing between (1) and (5) that a person typed and nobody
checked.** The dataset is generated, not hand-edited; the header of
`recorded.ts` says so and names the command that produces it.

---

## 2. How do I know it is right?

Everything in this table was run on 2026-10-17.

| Check | What it proves | Result |
|---|---|---|
| `npm test` | 176 assertions over the engine, the bands, the recurrence rules, the board views | **PASS** |
| `calculation.test.ts` (inside the above) | every audit's areas, sections and total re-derived from `data/` with the arithmetic written out longhand — no checklist, no engine, no shared helper | **PASS** |
| Chain audit (source record → dataset) | 558 point cells compared | **0 differ** |
| Chain audit (longhand → screen) | 19 totals, 57 section figures, 285 area figures, scraped from the running app | **0 differ** |
| `verify-template-formulas.py` | the entry template's Excel formulas evaluate to what the dashboard computes, to the hundredth | **PASS** |
| `verify-against-sheet.py` | the dataset against the workbook itself, read a second way | **PASS (2026-10-10)** — 279 area cells, 76 metadata fields. *Not re-run today: the workbook is deliberately not in the repository (see §9).* |
| `npm audit` | no known vulnerability in anything shipped | **0 vulnerabilities** (3 were open this morning; fixed today) |

Two implementations are required to agree at every level. The moment a test
imports the thing it is checking, it stops checking anything — that rule is
written into `calculation.test.ts` and should stay there.

---

## 3. Why doesn't it match the report I am holding?

Because **the source sheets' own stated percentages disagree with the source
sheets' own points.** Not occasionally — in **18 of the 19 audits**.

The workbook contains no formulas. Every percentage cell in it is a typed
number, so nothing recalculates, and the figures have drifted from the points
beside them. Section B and section C do not even use the same roll-up rule,
and no rule at all explains the stated total in 11 of 20 blocks.

| | |
|---|---|
| Audits carrying a stated total | 19 |
| Differ from their own points by ≥ 0.5 points | **18** |
| Overstate the contractor | 9 |
| Worst overstatement | **+14.24** (RPCO 440, Q1 2026: sheet says 60%, its points say 45.8%) |
| Worst understatement | −4.25 (AB 901, Q4 2025: sheet says 68%, its points say 72.3%) |

**The app scores the points, always.** The stated figure is not a record and
is never offered as an alternative — it survives as one muted line on the
audit page, for exactly the person holding last quarter's report and
wondering why the number moved.

> The points themselves are sound: all 40 section sums add up exactly. It is
> only the typed percentages that drifted.

---

## 4. How is a score calculated? Explain it to me without a screen.

Four sentences:

1. Every question carries a weight of 1 to 4 and is answered Full, Partial,
   No or N/A. **Points = weight × (Full 1, Partial 0.5, No 0).**
2. **N/A comes out of the top and the bottom** — a question that does not
   apply is not a zero, it is not asked.
3. An **area** scores points ÷ the weight that applied. A **section** is the
   mean of its areas. The **total** is the mean of the three sections.
4. Everything rounds to two decimals at each level and shows one.

A section is the mean of its *areas*, not of its points, which is why a small
area counts as much as a large one. That is the workbook's rule and it is
kept.

### Worked example — RPCO (440), Q1 2026

| Area | Scored | Applied | Area % |
|---|---:|---:|---:|
| A | 7.5 | 39 | 19.23 |
| B1 | 3 | 6 | 50.00 |
| B2 | 6 | 7 | 85.71 |
| B3 | 7.5 | 9 | 83.33 |
| B4 | 2 | 4 | 50.00 |
| B5 | 5 | 5 | 100.00 |
| B6 | 1 | 11 | **9.09** |
| B7 | 1.5 | 3 | 50.00 |
| B8 | 3 | 3 | 100.00 |
| B9 | 2 | 2 | 100.00 |
| B10 | 3 | 3 | 100.00 |
| B11 | 6 | 7 | 85.71 |
| B12 | 2 | 4 | 50.00 |
| C1 | 3 | 13 | **23.08** |
| C2 | 14.5 | 21 | 69.05 |

```
section A = 19.23                                        = 19.23%
section B = (50.00 + 85.71 + 83.33 + 50.00 + 100.00
             + 9.09 + 50.00 + 100.00 + 100.00 + 100.00
             + 85.71 + 50.00) / 12                       = 71.99%
section C = (23.08 + 69.05) / 2                          = 46.07%
TOTAL     = (19.23 + 71.99 + 46.07) / 3                  = 45.76%  → shown 45.8%
```

The sheet stated **60%** for this audit. The gap is +14.24 points, and the
reason is visible in the table: management (A) at 19%, subcontractor
management (B6) at 9%, leadership engagement (C1) at 23%. A roll-up that hid
those would be the problem, not the score.

---

## 5. What am I actually looking at on the board?

**A Health & Safety figure, not a five-discipline scorecard figure.**

The scorecard weights H&S 40%, Critical Risk 25%, Environment 10%, Security
10%, Worker Welfare 15%. `weightedOverall()` renormalizes over whichever
disciplines are scored, so that a partly-scored quarter is not understated —
which is right, and is also how a board can quietly mislead. **Only H&S is
scored today**, so the weights collapse onto it and a contractor's "overall"
*is* their H&S score, under a heading that says EHSS.

- **Fixed today.** The board now says so in its subtitle: *"Health & Safety
  only — 60% of the scorecard is not yet scored."* It appears automatically
  whenever one discipline is carrying the figure, and disappears when a
  second is recorded. Pinned by `scoredDisciplines()` and a test.

**Also fixed today:** the board's columns, watchlist, sub-region averages and
KPI row were reading `AuditSummary.total` (the H&S checklist total) while the
trend chart read `AuditSummary.overall` (the scorecard figure). They are the
same number *while H&S is alone*, which is why it read as correct. Record one
Environment score — which the audit page now allows anyone to do — and the
board would have started disagreeing with its own trend line about the same
contractor in the same quarter. Both now read `overall`, as the architecture
note always said they should.

---

## 6. Is the trend real, or did the list of contractors change?

**It was mostly the list changing, and the chart did not say so.**

Eight contractors were audited in Q4 2025, eleven in Q1 2026, **six in both**.
The old trend line averaged whoever was audited each quarter:

| | Q4 2025 | Q1 2026 | Movement |
|---|---:|---:|---:|
| All reviews (what the line plotted) | 68.26 (n=8) | 62.41 (n=11) | **−5.85** |
| Like for like (the 6 in both) | 67.87 | 65.73 | **−2.14** |

So of the 5.85-point fall on screen, **2.14 was the programme and 3.71 was
the arrival of five contractors who average 58.4**. A director reading that
chart would have concluded the programme was deteriorating nearly three
times as fast as it was.

- **Fixed today.** The chart now plots **both**, with a legend: like-for-like
  in the accent (the only line whose movement is the programme moving) and
  all-reviews in a second hue. The KPI delta has always been like-for-like —
  the KPI and the chart were telling two different stories, and now they do
  not. Pinned by a test that fails if the two ever converge silently.

---

## 7. How complete is this?

| | |
|---|---|
| Contractors | 13 (9 in Sub Region 1, 4 in Sub Region 2), all active |
| Quarters on record | 2 — Q4 2025 and Q1 2026 |
| Audits | 19, all approved |
| Audited in Q4 2025 | 8 of 13 — missing AF(882), NBC(026), RPCO(440), TDP(892), SD(876) |
| Audited in Q1 2026 | 11 of 13 — missing AB(901), OT2(D&B) |
| **Audited in both** | **6** — the only contractors a trend can honestly be drawn for |

What **no** audit on record carries:

| | |
|---|---|
| 81 per-question answers | **0 of 19** — the source sheets kept a narrative per question with no machine-readable answer |
| Critical Risk Control hazard scores | 0 of 19 |
| Environment / Security / Worker Welfare | 0 of 19 |

Consequences, stated plainly: there is **no question-level evidence**, so the
gap register, the SHEW heat-map, the issue categories and per-question
recurrence have nothing behind them and are not drawn. Recurrence is
therefore measured at **area** level — below target this review and the one
before — which is the owner's own definition applied where real numbers exist.
With two quarters, "recurring" can only mean "twice".

This is why the app renders an empty view as *absent* rather than as a zero.
"0 gap observations" on contractors averaging 62% would read as a clean
audit.

---

## 8. How is it categorised?

Six independent schemes, none of them overlapping:

| Scheme | Count | Values |
|---|---|---|
| Checklist sections | 3 | A Management · B Process & Procedures (on site) · C Planning & Commitment |
| Checklist areas | 15 | A, B1–B12, C1, C2 |
| Questions | 81 | weights 1, 2, 3, 4 |
| Rating bands | 5 | Compliant 90–100 · Mostly 80–89 · Moderately 70–79 · Minimally 60–69 · Non-Compliant below 60 |
| Issue categories (*why* a requirement was missed) | 7 + 1 | DOC, PLN, IMP, CMP, SUP, RES, LED, plus GOOD |
| Scorecard disciplines | 5 | H&S 40 · Critical Risk 25 · Environment 10 · Security 10 · Worker Welfare 15 |
| Critical-risk hazards | 14 | the CRC register |
| SHEW pillars | 6 | Safety, Health, Environment, Welfare, Security, Cross-cutting |

Two rules keep this explainable:

- **A category is a CAUSE, never a PLACE.** Subcontractor control used to be
  both an issue category and checklist area B6, so a missing subcontractor
  assessment was filed as its own cause when it is a *documentation* failure
  that happens to sit in B6. Keeping the axes apart is what lets a report
  say "our B6 problem is 70% documentation" — which names the fix and names
  the owner.
- **Categories are multi-select**, so counts over them sum to more than the
  number of findings. Every view that shows them says so. A finding usually
  has more than one cause and forcing one label loses the rest.

**No free text anywhere in the audit.** Answers are Full/Partial/No/N-A and
the reason is picked from the fixed list. This is not a UI preference — a
comments box is how an audit tool acquires personal data by accident, and
personal data is what would change which laws apply (§9).

---

## 9. How does new data get in?

**Route A — the entry template** (`templates/HS-AUDIT-TEMPLATE.xlsx`).
Generated by `scripts/build-audit-template.py`. It keeps the exact geometry
the importer reads and computes area, section, total and rating with the same
rules as the app, so a quarter entered through it agrees with the dashboard
*by construction*. `verify-template-formulas.py` reads the formulas back out
of the file, evaluates them against a real audit and requires equality — not
a tolerance. A tolerance would have accepted the drift it actually found
(section C of ABYATONA 134 at 53.02 against the app's 53.03), which is why
every level carries `ROUND(...,4)`.

**Route B — typed into the app.** The audit page carries all 15 areas and all
81 questions, and every field is editable. An area scores from its questions
once all of them are answered and from its recorded points until then, per
area — so re-auditing one area never discards another area's recorded data,
and the page says which source each area is on.

**The guard on both routes** is `verify-against-sheet.py`: it re-reads the
workbook by searching for the sheet's *own printed labels* where the importer
uses fixed row offsets. Two different ways of reading one file, required to
agree, so a shifted row in next quarter's template fails loudly instead of
importing the wrong cells. It is also what caught the PPCO block pasted under
SIBS in Q4 2025 — **byte-identical in all 15 areas**, declared and excluded,
which is why the record holds 20 blocks and the dataset 19.

**Run it on every new quarter.** It is the single most valuable check here.

Two standing cautions:

- The workbook is **not** in the repository. It holds 28 embedded site
  photographs and the full work orders, neither of which may reach the app
  (§10). Keep it where the auditors keep it and point the script at it.
- **Never re-save the populated workbooks with openpyxl.** A round-trip test
  took one from 10.6 MB to 0.4 MB and discarded all 28 photographs silently.

---

## 10. Where is it stored, and who can change it?

**This is the honest weakness, and it is the one worth acting on.**

| Question | Answer today |
|---|---|
| Where does the baseline live? | Compiled into the application bundle (`recorded.ts`). Read-only, identical for everyone, versioned in git. |
| Where do edits live? | **`localStorage`, in the browser that made them.** Key `ehss-v2`. |
| Are edits shared? | **No.** An edit made on one laptop is invisible on every other. |
| Are edits backed up? | **No.** Clearing site data discards them. |
| Is there a change log? | **No.** Nothing records who changed what, or when. |
| Is there a login? | **No.** A cookie holds a display name and a role; the role decides which buttons appear and is *not* a security boundary. Anyone who can reach the URL can open everything. |
| Does anything leave the browser? | **No.** There is no database, no API and no analytics call. Verified: the only network write in the whole app is the cookie-clearing route. |

So: **the recorded 19 audits are reliable, reproducible and the same for
everyone. Anything typed into the app on top of them is not yet a record** —
it is one person's working copy.

That is acceptable for review and demonstration. It is not acceptable the day
an auditor enters a quarter through the app and expects a director to see it.
What closes it is in §12.

---

## 11. What about personal data?

No worker records, no photographs, no auditor names, no phone numbers.
Contractors are **initials plus the last three digits of the work order** —
`SIBS (838)`, `AF (272)` — and nothing more reaches the app. The only personal
data in the whole system is the optional display name in the session cookie.

This is not a styling choice. `docs/COMPLIANCE-KSA.md` §4 is what permits this
data to be hosted outside the Kingdom, **on the basis that it identifies
nobody**. A field that names a person does not add a feature; it changes
which laws apply and where the system may run. It also settles the source
sheet's three different spellings of SIBS by construction.

---

## 12. What would I need before I trusted this operationally?

In the order that matters:

1. **A database.** Until then, every edit is one browser's private copy.
   Model it on `src/lib/ehss/`; read `COMPLIANCE-KSA.md` §4 and §5.5 before
   the first migration, because the no-personal-data schema rules are what
   keep the hosting determination true. Region is unconstrained — choose on
   latency, cost and operational fit.
2. **Authentication**, and a role that is a boundary rather than an
   affordance.
3. **A change log** — who changed which figure, when, and from what. An audit
   tool without one cannot answer the first question a dispute raises.
   It can be kept with no personal data: a role and a timestamp, not a name.
4. **A third quarter.** Two quarters support "it happened twice". They do not
   support a trend, and only six contractors even have two.
5. **The four unscored disciplines**, or an explicit decision that the
   programme reports H&S alone — in which case the heading should say H&S.
6. **Question-level answers** via the template or the app. Everything built
   for findings, causes and per-question recurrence is already there and
   tested against a synthetic fixture; it is waiting for real answers.

---

## What this audit changed

| Finding | Severity | Status |
|---|---|---|
| Board, KPIs and watchlist ranked on the H&S checklist total while the trend used the scorecard figure — silently divergent as soon as a second discipline is scored, which the editable audit page now permits | **High** — two numbers for the same contractor | Fixed, both read `overall`, pinned by a test that records a second discipline |
| Trend line was not like-for-like; 63% of the apparent 5.85-point decline was a change in who was audited | **High** — a wrong call on a real decision | Fixed, both series plotted with a legend; pinned |
| Nothing said the headline figure covers one discipline out of five | **Medium** — a scope misread | Fixed, the board states it and the share unscored |
| 3 dependency vulnerabilities (1 moderate, 2 high) | **Medium** | Fixed, `npm audit` clean; `package.json` unchanged, lockfile only |
| Workbook-level verification not runnable here (workbook deliberately absent) | **Low** | By design; last PASS 2026-10-10, re-run each quarter at source |

## How to repeat this audit

```bash
npm test                                   # 176 assertions
npm audit                                  # expect: 0 vulnerabilities
python3 scripts/verify-template-formulas.py \
    templates/HS-AUDIT-TEMPLATE.xlsx data/hs-audits-2025Q4-2026Q1.json
python3 scripts/verify-against-sheet.py \
    <path-to>/HS_AUDIT_FINDINGS.xlsx src/lib/ehss/recorded.ts
```

The chain audit — source record → dataset → longhand arithmetic → the
rendered screen — is one command:

```bash
python3 scripts/audit-chain.py                     # links 1-3, no app needed

npm run dev &                                      # for the fourth link
PLAYWRIGHT_NODE_PATH=/path/to/node_modules \
  python3 scripts/audit-chain.py --screen          # all four
```

It exits non-zero and names the cell when anything disagrees — verified by
altering one point value in the dataset and watching it fail with
`ab901-2025-Q4 A: {'scored': 36.0 ...} vs (37.0, ...)`. A check that cannot
fail is not a check.

Playwright is needed only for the fourth link and is deliberately **not** a
dependency of this project — it is resolved at runtime from
`PLAYWRIGHT_NODE_PATH`. Do not symlink it into `node_modules`; the bundler
then tries to follow it when building the app.
