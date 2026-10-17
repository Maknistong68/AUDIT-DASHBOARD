# Fix plan — closing the three-role review

*Written 2026-10-17 against commit `068be07`. Covers every gap in the
auditor / director / admin walkthrough: 60 questions, which collapse into
**31 pieces of work in 7 phases**.*

Each item says what "done" means in a way someone else can check. Effort is
days of focused work by one person who knows this codebase.

---

## Read this before anything else: the auth decision is a compliance decision

Six of the twenty admin questions — no login, no audit trail, no sharing, no
backup, no user management, no "who signed this off" — have the same answer:
**add a database and identity.** It is the single highest-value phase.

It is also the one thing in this plan that can change where this system is
allowed to run.

`docs/COMPLIANCE-KSA.md` §4 is explicit:

> The moment a field names a worker, an auditor or any other individual,
> this is personal data under PDPL and the cross-border rules in §1 apply
> again.

**A login account names an individual.** Adding authentication is therefore
not only engineering. It puts the hosting determination — currently
"unconstrained, may be stored outside the Kingdom" — back on the table, and
may bring a Transfer Risk Assessment back with it.

### Three options, and the recommendation

| | What it means | Compliance effect |
|---|---|---|
| **A. Federate, store nothing** *(recommended)* | Identity lives in NEOM's existing IdP (SSO / Entra). This app stores **no user table** — only an opaque subject id and a role on the session. The audit trail records **role + timestamp + opaque id**, never a name or an email. | Smallest surface. The person stays in a system NEOM already runs and has already assessed. Still needs the DPO to confirm that an opaque id which singles out an individual is acceptable under §4 — it probably is **not** zero personal data, and saying otherwise would be dishonest. |
| **B. Own user table** | The app stores emails and names. | §4 is void. Expect in-Kingdom hosting or a TRA. Do not choose this by accident. |
| **C. Shared role passwords, no individuals** | One credential per role, no identity at all. | Keeps §4 intact. **But the audit trail then cannot say who** — which is the whole point of adding one. Honest only as a stopgap. |

**Do this before writing any auth code:** take options A and C to the DPO
(§5.4 names the contact) with the question *"does an opaque subject id in the
audit trail change the §4 determination?"* Phase 5 cannot start until that
is answered, and the rest of the plan is deliberately arranged so nothing
else waits on it.

---

## Phase 0 — Things that are embarrassing and small
**½ day · no dependencies · do today**

| # | Fix | Done when | Why now |
|---|---|---|---|
| 0.1 | **Print is white-on-white.** `@media print` turns cards white but leaves `--ink-1` at `#f6f7f4`. Override the ink, grid, borders and band colours for print; keep charts legible. | A print-emulated screenshot of `/`, `/contractors/[id]` and an audit page is readable end to end. Add it to the responsive sweep so it cannot regress. | Proven defect. A director PDFs this for a meeting and gets blank pages. |
| 0.2 | **`/audits` opens on an empty quarter.** It defaults to the current quarter (Q4 2026) and leads with "0 of 13 complete", which reads as "nobody has done anything". Default to the latest quarter *with reviews on record*, and let the picker move forward. | Opening `/audits` cold shows Q1 2026 with 11 of 13 complete. | First impression is wrong today. |
| 0.3 | **Quarters are skipped.** `quarterOptions()` is *on record + current + previous*, so Q2 2026 does not exist in the list at all. Enumerate the continuous range from the earliest record to the current quarter. | The picker runs Q4 2025 → Q4 2026 with no holes; a quarter nobody audited still appears and reads "0 of 13". | A missing quarter is invisible rather than visibly unaudited. |
| 0.4 | **`resetLocalEdits()` is wired to nothing.** It exists in the store and no UI calls it. | An admin can discard this browser's local edits, with a confirm naming how many reviews it will drop. | Dead code, and the only recovery path from a bad local edit. |
| 0.5 | **Nothing in the app says the numbers are checked.** `DATA-ASSURANCE.md` exists and is invisible. | A "How these numbers are produced" link on the board footer and the audit page, opening the provenance summary. | #11 of the director's twenty, and the answer already exists. |

---

## Phase 1 — The auditor's screen
**2 days · depends on nothing**

| # | Fix | Done when |
|---|---|---|
| 1.1 | **Last quarter, on the screen they are using.** The audit page shows only the review being filled. Add a per-area "last review" column: that area's previous score, and a flag where it was below target twice. | Opening a draft for a contractor with history shows, per area, last quarter's figure beside the field. Pinned by a test over a two-quarter contractor. |
| 1.2 | **Hazard scope carry-forward.** The 14 CRC in-scope ticks are re-entered from memory every quarter. Pre-tick from the contractor's previous review, marked as carried and freely changeable. | A new review for a contractor whose last review scoped Fire and Lifting opens with those two ticked and labelled "carried from Q1 2026". |
| 1.3 | **Scoring rules where the scoring happens.** The formula is on the admin Reference page only. Put a compact "how this is scored" disclosure in the entry toolbar. | An auditor can read what Partial scores without leaving the form. No new prose on the page by default — a disclosure, closed. |
| 1.4 | **Say that a save is local.** The Save button implies durability it does not have. Until Phase 4, label it honestly. | The entry footer states that edits are held in this browser. Removed by Phase 4, not before. |
| 1.5 | **Submit leads somewhere.** Submitting sets a status and tells nobody. Add a "submitted, awaiting approval" filter to `/audits` and a count on the admin's view. | After submitting, the review appears in a queue an admin can find without being told it exists. |
| 1.6 | **Say why there is no photo or notes field.** Auditors will reach for both. | One line in the entry disclosure (1.3): answers and causes only, and why. Not an apology on the page. |

---

## Phase 2 — The director's screen, and getting it out of the app
**3 days · 2.4 depends on 0.1**

| # | Fix | Done when |
|---|---|---|
| 2.1 | **"My patch."** Both sub-regions are shown and nothing filters to one. Add a sub-region selector in the board header that scopes every tile, remembered per browser. | A director picks Sub Region 2 and the KPIs, columns, watchlist and target card all narrow. The programme line stays, labelled, so they can see themselves against it. |
| 2.2 | **Coverage on the board.** Who has *not* been audited is on `/audits`, not where a director looks. | A tile reads "11 of 13 audited this quarter" and names the two who were not. |
| 2.3 | **Compare two contractors.** Possible via the checklist matrix; not where anyone would look. | Selecting a second contractor in the drill-down shows both area profiles against each other and against the programme. |
| 2.4 | **Export.** No CSV, no PDF. | A CSV of the current view (contractor, quarter, score, band, areas below target) from the board and the contractor page; print produces a usable PDF after 0.1. |
| 2.5 | **Provenance where the number is read.** The "the sheet said 68%" line is on the audit page only. | A contractor's page carries the same line for any review whose source sheet disagreed. |
| 2.6 | **Say the data is two quarters old at most.** There is no "is 62% normal" answer and will not be one for a year. | The trend card states how many quarters are on record, so nobody reads two points as a trend. |

---

## Phase 3 — Actions: what are we doing about it
**4 days · model now, shared when Phase 4 lands · the largest functional gap**

The board diagnoses and stops. Every director's next sentence is *"and what
is being done?"* There is no answer anywhere in the app.

**The design constraint that makes this safe:** an action's owner is a
**function, not a person**. `issues.ts` already carries exactly that
vocabulary — each of the seven categories names its owner ("Contractor EHSS
management", "Planning and engineering", "Site supervision"…). Actions
inherit it. **No names, no emails, no assignees** — the no-personal-data
invariant survives intact, and a role is more useful anyway because people
move.

| # | Work | Done when |
|---|---|---|
| 3.1 | **Model.** An action attaches to a *scope* (area, hazard or question) on a *contractor*, carries an owner role from the category, a target quarter, a status (open / in progress / closed / carried), and nothing else. No free text — the cause list is the vocabulary. | `actions.ts` with its rules pinned: an action cannot name a person, cannot carry free text, and closes only against a later review. |
| 3.2 | **Raise.** From the drill-down, on any area below target. | Level 2 offers "raise an action" on a failing area; it pre-fills owner from the dominant cause where causes exist. |
| 3.3 | **Track.** A board tile and a contractor section: open, overdue, closed this quarter. | A director reading RPCO at 45.8% sees what is open against it and who owns it. |
| 3.4 | **Close honestly.** An action closes when the next review scores that scope at or above target — not when somebody ticks it. | Closure is derived from the next review, pinned by a test; a manual close is recorded as "closed without evidence" and reads differently. |

> **Sequencing note.** This can ship on `localStorage` in week 2, but an
> action plan that only one browser can see is worse than none — it looks
> shared and is not. Build the model in Phase 3, ship the UI behind the
> database in Phase 4. If the database slips, ship it local **with 1.4's
> honesty label**, not silently.

---

## Phase 4 — The database
**6 days · unblocks sharing, backup, history, admin · no compliance gate**

The schema already exists and is further along than it looks:
`supabase/migrations/` has 16 tables with RLS, reference data, the full
checklist and the contractor register. **The app is not wired to it.**

| # | Work | Done when |
|---|---|---|
| 4.1 | **Extend the schema** for what has been added since it was written: `audit_scoped_responses` (the 18-scope model), `actions` + `action_events`, `audit_events` (the trail, role-only for now). | Migrations `0005`–`0007` apply clean; `scripts/verify-sql-against-sheet.py` still passes. |
| 4.2 | **Wire the store.** `store.tsx` keeps its interface; its implementation moves from `localStorage` to the database. Pages do not change. | `useEhss()` reads and writes through the database; `recorded.ts` becomes the seed, not the runtime baseline. |
| 4.3 | **Migrate local edits.** Anything in a browser's `ehss-v2` key is offered for upload once, then the key is retired. | A browser holding local edits is prompted once; declining discards nothing until they accept. |
| 4.4 | **Backup.** | A documented, tested restore — not just "Supabase takes backups". Prove it by restoring into a scratch project. |
| 4.5 | **Re-run the chain audit against the database.** `audit-chain.py` currently walks source → `recorded.ts` → screen. It must walk source → database → screen. | All four links pass with the app reading from the database. This is the check that the migration did not quietly change a figure. |

---

## Phase 5 — Identity and the audit trail
**4 days · GATED on the compliance decision above · do not start first**

| # | Work | Done when |
|---|---|---|
| 5.1 | **Authentication**, per whichever option the DPO confirms. Option A: federate to NEOM's IdP, store no user table. | The `demo_profile` cookie is gone. An unauthenticated request reaches nothing. |
| 5.2 | **Role as a boundary, not an affordance.** Today the role is self-selected and decides which buttons appear. | A viewer's write request is refused at the database by RLS, not hidden in the UI. Proved by a test that attempts the write. |
| 5.3 | **Audit trail.** Every change to a score, an answer, a status or an action records what changed, from what, to what, when, and by which role (+ opaque subject id if §4 permits). | A contractor's page shows the history of any figure that was edited after approval. |
| 5.4 | **Update the ROPA.** §2 of the compliance doc is the Record of Processing Activities and will no longer be accurate. | `COMPLIANCE-KSA.md` §2 and §4 reflect what authentication added, and say whether the hosting determination survived. |

---

## Phase 6 — The admin console
**3 days · depends on Phase 4 and 5**

| # | Work | Done when |
|---|---|---|
| 6.1 | Contractor register — add, rename, move sub-region, deactivate. | Without touching code. Initials + three digits enforced at entry, not by convention. |
| 6.2 | Discipline weights and the 90% target become settings, versioned by effective quarter. | Changing the target does not silently rewrite last quarter's "below target" counts. **This is the trap** — pin it with a test. |
| 6.3 | Import a quarter from the app. | Upload the completed template, see the verifier's output, accept or reject — the `verify-against-sheet.py` guard runs in-app rather than on someone's laptop. |
| 6.4 | Role assignment, per the Phase 5 option. | An admin grants and revokes without a deploy. |

---

## Phase 7 — The seventeen missing checklists
**Blocked on content, not on code**

Nothing here is engineering. `scopes.ts` takes sections and the rest of the
machinery is written and tested. What is needed from the owner:

- the **14 CRC hazard checklists** — question text, weight 1–4, grouped;
- **Environment**, **Security**, **Worker Welfare** — same.

Each one is a single edit to `scopes.ts` plus a test pinning its question
count. **A day's work for all seventeen once the content exists.** Until
then `/findings` stays a single honest line and the board keeps saying 60%
of the scorecard is unscored, both of which are correct.

---

## Order, and why

```
Phase 0  ██                      ½d   independent, do today
Phase 1  ████                    2d   independent
Phase 2  ██████                  3d   2.4 needs 0.1
Phase 3  ████████                4d   model independent, UI wants Phase 4
Phase 4  ████████████            6d   independent — start the DPO question NOW, in parallel
Phase 5  ████████                4d   GATED on the compliance answer
Phase 6  ██████                  3d   needs 4 + 5
Phase 7  ██                      1d   blocked on content
                                ───
                                23d  ≈ 5 working weeks, one person
```

**Start three things on day one:** Phase 0 (half a day of fixes), the DPO
question (it has the longest lead time and gates Phase 5), and a request to
the owner for the seventeen checklists (Phase 7 is otherwise idle work at
the end).

---

## Traceability — every finding has a home

| Role | Finding | Phase |
|---|---|---|
| Auditor | 2 last quarter's gaps · 15 hazard carry-forward · 7 scoring rules · 9 no photo/notes · 12 local save · 13 after submit | 1.1 · 1.2 · 1.3 · 1.6 · 1.4 · 1.5 |
| Auditor | 19 concurrent editing · 20 print for signature | 4.2 · 0.1 |
| Auditor | 16 CRC checklist · 17 Env/Sec/WW | 7 |
| Auditor | 18 does my total match the sheet | 0.5 |
| Director | 7 my sub-region · 19 who is unaudited · 15 compare · 16 send it · 17 provenance · 8 is 62% normal | 2.1 · 2.2 · 2.3 · 2.4 · 2.5 · 2.6 |
| Director | 11 can I trust it | 0.5 |
| Director | 12 what are we doing · 13 contractor response | 3 |
| Director | 6 why did it drop · 9 what is the score made of | 7 (needs causes) · 1.3 |
| Director | 10 who audited this | 5.3, subject to the §4 answer |
| Director | 20 alert me | Deferred — see below |
| Admin | 1 who can see this · 2 users · 3 who changed what | 5.1 · 6.4 · 5.3 |
| Admin | 4 where is the data · 5 backup · 16 reset local edits | 4.2 · 4.4 · 0.4 |
| Admin | 6 add a contractor · 9 weights · 10 target · 11 import | 6.1 · 6.2 · 6.2 · 6.3 |
| Admin | 7 edit the checklist · 8 add Environment | 7 (content), 6.2 (weights only) |
| Admin | 15 restore a deleted review | 4.2 — a soft delete the database can undo |
| Admin | 17 PDPL in-app · 20 scale to 12 quarters | 0.5 · 4.5 |

### Deliberately not doing

- **Alerting / email digests (director 20).** Wait until the data moves more
  than once a quarter. An alert on a quarterly figure is a calendar
  reminder, and there is already a calendar.
- **A real benchmark (director 8).** Cannot be invented. It arrives with the
  fourth quarter of data, not with code.
- **Free text or photo uploads.** Refused by the compliance position, not by
  the backlog. See §4 of the compliance doc before anyone asks again.

---

## What could go wrong

| Risk | Mitigation |
|---|---|
| **The DPO answer kills option A** and identity has to live in-Kingdom. | Phases 0–4 and 6.1–6.3 do not depend on it. Only the trail's "who" and role enforcement wait. Option C ships role enforcement without identity if the answer is slow. |
| **The database migration changes a figure.** | 4.5 is the guard: the chain audit must pass against the database before anything is switched over. It already catches a single altered point cell. |
| **Phase 6.2 rewrites history.** Making the target a setting can silently restate every past quarter's "below target". | Version settings by effective quarter and pin it with a test before the UI exists. |
| **Actions become a to-do list nobody updates.** | 3.4: closure is derived from the next review, not from a tick. The register cannot rot into green. |
| **Phase 7 content never arrives.** | Nothing else blocks on it, and the app already says plainly which 60% of the scorecard is unscored. |
