# Saudi law compliance — assessment and remediation

**Scope:** the EHSS contractor audit dashboard in this repository.
**Assessed:** September 2026, against the app as it stands on this branch;
updated 2026-10-30 for the observation log (§2, §4).
**Status:** compliant in design; the remaining items are hosting and
paperwork decisions, not code.

> This is an engineering assessment of what the software does with data. It
> is not legal advice. Before real audit data goes in, NEOM's own data
> protection officer and legal counsel should sign off — this document is
> written to make that review fast, by telling them exactly what the system
> holds.

---

## 1. Which laws apply

| Instrument | Regulator | Applies here because |
|---|---|---|
| **PDPL** — Personal Data Protection Law, Royal Decree M/19 (2021), amended M/148 (2023); Implementing Regulations in force 14 Sept 2023, full enforcement since **14 Sept 2024** | SDAIA | It governs any processing of personal data of individuals in the Kingdom, and applies extraterritorially — hosting abroad does not remove the obligation |
| **Regulation on Personal Data Transfer Outside the Kingdom** | SDAIA | The app is deployed on Vercel, outside KSA |
| **NDMO** National Data Management & Personal Data Protection Standards, incl. the data classification framework (Public / Confidential / Secret / Top Secret) | NDMO (under SDAIA) | NEOM is a public-sector-linked entity; its operational data falls under the national classification and residency framework |
| **NCA ECC / CCC** — Essential and Cloud Cybersecurity Controls (CCC-2:2024) | NCA | Applies to government entities and operators of critical national infrastructure using cloud services |

**The key distinction:** PDPL protects *natural persons*. Contractor
companies are not natural persons, so contractor audit scores are **not
personal data**. They are, however, NEOM operational data, which is what
brings NDMO classification and residency into play. These are two separate
obligations and they have two different answers.

---

## 2. What the app actually holds

This was verified against the code, not assumed.

### Personal data: one field

| Item | Value | Where | Lifetime |
|---|---|---|---|
| Display name | Free text, ≤80 chars, self-chosen | `demo_profile` cookie, `httpOnly`, `sameSite=lax` | 30 days, or until "Restart demo" |

That is the **entire** personal-data surface. The name is chosen by the
visitor, is never validated as a real name, is never written to a server,
never appears in any audit record, and is never transmitted anywhere except
as a cookie header back to the origin that set it.

### Not personal data, but regulated as NEOM operational data

- Contractor organizations and project numbers (`Al Fahd (1272)`)
- Quarterly discipline scores and checklist answers
- Observation codes and critical-risk hazard scores
- **Observation text** (see below): the auditors' own sentences from the
  Excel audit sheets, personal names removed

### Free text: the observation log, personal names removed

*Added 2026-10-30, on the owner's decision.* The app holds the auditors'
observation text from the Q4 2025, Q1 2026 and Q3 2026 audit sheets — 1,398
sentences in `src/lib/ehss/recorded-observations.ts`, each tied to a
contractor, a checklist area and a quarter, never to a person. It is the one
place free text exists, and it is admitted on two conditions:

1. **Personal names are removed by rule.** Auditors type names into those
   sheets ("Mr. X was operating the MEWP"). `src/lib/ehss/name-patterns.json`
   is a single `pattern` regex, compiled by `names.ts` (the app's definition),
   `import-observations.py`, `verify-observations.py` and
   `check-observations.py`, that replaces a titled personal name with
   `a worker`. It removed 39 names from the 1,557 extracted observations.
2. **Untitled personal names are removed by review.** A pattern cannot know a
   name that carries no title. Every observation was read through and the 15
   untitled names found were rewritten by hand (ids in the commit that made
   them, "Assign first-pass causes to every observation"); a later
   independent sweep found none left. Standalone runs of nine or more digits
   — full work orders inside document references — are shortened to their
   last three.

**The limits of this control, stated plainly.** It removes personal names, in
Latin script, and nothing else. It does **not** remove:

- **Company names.** About 240 observation texts name the contractor in
  full (its company name), and some name subcontractor companies. The
  contractor rule in §4 (initials and the last three digits of the work
  order) therefore holds for the `name` and `code` fields, **not** inside the
  observation text.
- **Roles.** A person can remain indirectly identifiable by their role at a
  named contractor in a given quarter — a sentence that says what a
  particular post-holder at a named company did or lacked is about one
  person even though it carries no name. Whether role-level references are
  acceptable is a decision for the owner and the DPO; it has not been made.
- **Arabic-script text.** The pattern and the review covered Latin script
  only.

The unreviewed extract, which still had the untitled names, was committed
once and pushed to GitHub. On the owner's instruction (2026-10-30) it was
removed from **every commit on the branch** by a history rewrite on that date.
That is not a purge: the repository on GitHub is **public**, and the three old
commits (a67b1a2, 9ce9faa and 0bcfbac), which contained the pre-review
extract, **remained reachable on GitHub by SHA** until GitHub purges them.
Pending, the owner's actions: make the repository private, and ask GitHub
Support for sensitive-data removal of those SHAs. Until both are done the
extract must be treated as having been public. Only reviewed text is in the
branch now, and the raw extract is regenerated into a scratch path when
needed and never committed. Photographs, the "Evidence (Photo)" column and
the auditor and phone-number rows were never read.

Where it lives: until the database arrives in phase 2, the log ships **in the
app bundle like the scores** — static and the same for every visitor — but
as a separate chunk loaded only by the Observations page. Nothing in the app
accepts typed observation text yet. When auditors can enter it (phase 5) the
field will warn on name patterns, using the same `names.ts`, because
removal by review is a one-off and entry is ongoing.

### Deliberately absent

No worker records. No names, ID or Iqama numbers, passports,
nationalities, salaries or wage data. No photographs, attachments or
document store. No auditor contact details. No free-text field anywhere in
the scoring path, and no text entry in the app other than the display name.
No analytics, telemetry or third-party trackers. No cookies other than the
one above.

**Why this holds under change:** the absence is structural, not a policy
someone has to remember. Answers are enums; the reasons on a finding are
codes from a fixed list; there is no upload path. The most common way an
audit tool acquires personal data — a free-text "comments" box or a site
photograph — does not exist here. The observation log is imported text, not
an input, and is checked by a pattern and a read-through before it is
stored. Keep it that way and the compliance position does not drift.

---

## 3. Assessment against PDPL

| PDPL obligation | Status | Reasoning |
|---|---|---|
| Lawful basis for processing (Art. 5–6) | ✅ | The only personal data is a self-supplied display name used to render the session. Legitimate interest; no sensitive categories involved |
| Data minimization (Art. 10) | ✅ **Exemplary** | One optional free-text name, plus observation text held only after names are removed by rule and by review (§2). The architecture actively prevents collecting more |
| Sensitive personal data (Art. 1, 16) | ✅ N/A | None processed. Health data in this app is *organizational* H&S performance, not any individual's health |
| Privacy notice / transparency (Art. 12) | ⚠️ **Gap** | `/welcome` asks for a name without saying what happens to it. **Fix in §5.1** |
| Consent & withdrawal (Art. 5, 11) | ✅ | Providing the name is voluntary; "Restart demo" deletes it |
| Right of access, correction, destruction (Art. 4) | ✅ | The visitor holds the only copy and can change or delete it at any time, unilaterally |
| 30-day response to data subject requests | ✅ N/A | No stored records to respond about |
| Records of Processing Activities (Art. 31) | ⚠️ **Gap** | Required of controllers. **This document serves as the RoPA entry — §2 is the record.** Register it with NEOM's DPO |
| Breach notification, 72 h to SDAIA | ⚠️ **Gap** | No documented procedure. Low exposure — a breach of this app exposes no personal data — but the procedure must exist. **§5.3** |
| Data Protection Officer | ℹ️ | NEOM-level appointment, not app-level. Confirm the app is in the DPO's register |
| Cross-border transfer (Art. 29) | ✅ *currently* | No personal data is transferred: the cookie never leaves the browser. **This changes the moment a database is added — see §4** |
| Registration on the National Data Governance Platform | ℹ️ | NEOM-level obligation; confirm this system is listed |

**PDPL verdict: compliant.** Three documentation gaps, no code defects.

---

## 4. Hosting and residency — settled

**The project has determined that the data this app holds is not sensitive
and may be stored outside the Kingdom.** (Owner's decision, recorded
2026-10-07.) The app is therefore built and hosted on that basis: no
in-Kingdom hosting requirement, and no Transfer Risk Assessment gating
deployment.

That determination rests on what §2 describes, so it holds only while those
facts hold:

- **No personal data beyond an optional display name.** The moment a field
  names a worker, an auditor or any other individual, this is personal data
  under PDPL and the cross-border rules in §1 apply again. That is why the
  no-personal-data rule in `CLAUDE.md` is an invariant and not a preference.
- **Contractor-level results only.** Organizational audit scores, not
  individual performance.
- **Free text only as observation text with personal names removed, and no
  uploads.** The observation log (§2) is held on the owner's decision of
  2026-10-30 *because* personal names have been removed from every sentence
  — by the shared pattern and by a read-through. It is not anonymous: company
  names and roles remain in the text (§2, limits of the control). A sentence
  that named a worker would void this determination. A live
  comments box or a site photograph is how an audit tool acquires personal
  data by accident, and neither exists. Entry of observation text by
  auditors (phase 5) re-opens this item: it must warn on name patterns
  before it ships.
- **Contractors are identified only by initials and the last three digits of
  the work order** — `SIBS (838)`, `AF (272)`. Applied when the real Q4 2025
  and Q1 2026 audits were imported (owner's instruction, 2026-10-07): full
  work orders and names as typed stay in `data/`, outside `src/`, so they are
  not bundled into the client. The imported audits also carry **no auditor
  names or mobile numbers** — row 3 of every sheet block was deliberately not
  read (`scripts/import-hs-audit.py`), because importing it would have put
  personal data in the app and broken both §2 and this section in one step.
  The observation importer and the Q3 review importer keep the same rule (the
  review workbook's auditor row is row 4 and its repeats at 115 and 148).

**Design consequences, applied:**

1. Host anywhere. Vercel, or any managed platform, in any region.
2. The database, when added, may sit in any region. Pick on latency, cost
   and operational fit rather than residency.
3. No SCCs, Binding Common Rules or transfer assessment are needed for the
   data as scoped.
4. **Re-open this section if the scope changes.** Adding worker records,
   named auditors, photographs or un-reviewed free text does not merely add a
   feature —
   it changes which laws apply and where the system may run.

**Open item: repository visibility.** The GitHub repository is public. That
contradicts the premise of this section that `data/` — full work orders, full
contractor names and the observation text as extracted — is kept out of
public view and that `src/` carries only initials and the last three digits.
The three pre-review commits were also reachable by SHA after the history
rewrite (§2). Owner decision pending: make the repository private, and
request GitHub Support's sensitive-data removal for those SHAs.

## 5. Remediation — fastest path, nothing ripped out

Ordered by effort. **None of these require redesigning anything.**

### 5.1 Privacy notice on `/welcome` — *~15 minutes, do this first*
One short paragraph under the name field: what the name is used for, that
it stays in the browser, that nothing is sent to a server, and that
"Restart demo" erases it. This closes the transparency gap and is the
single highest-value change in this list.

### 5.2 Make the name optional and say so — *~15 minutes*
The field already defaults to "Guest". Label it optional and suggest
initials or a job title. Data minimization you can demonstrate rather than
assert.

### 5.3 Breach-response note — *~30 minutes, documentation only*
Half a page: who is notified, the 72-hour SDAIA clock, and who contacts
the DPO. Keep it next to this file.

### 5.4 Register with NEOM's DPO — *one email*
Send this document. §2 is your Record of Processing Activities.

### 5.5 When the database is added — *design-time constraints*
- Keep the no-personal-data rule at the **schema** level: no worker table,
  no free-text column in the scoring path, no attachment storage. The one
  free-text column is the observation text (phase 2 moves the log into the
  database); it takes only text that has passed `names.ts` and the review in
  §2.
- Auditor identity: store an opaque user id, not a name, in audit records.
  If auditors need to be identifiable, that is a deliberate scope change
  requiring a lawful basis and a retention period — not a default.
- Database region is unconstrained (§4) — choose on latency, cost and
  operational fit.
- Set a retention period for audit records (EHSS records typically 3–7
  years; confirm against NEOM's retention schedule).

---

## 6. What was removed, and why it mattered

The dormant Supabase layer was deleted from this branch. It was dead code —
unreachable from the UI and modelling a welfare-audit schema that no longer
matches this app — but it was also the **largest compliance liability in
the repository**:

- `profiles.full_name` — a table designed to hold real people's names
- `audits.auditor_id` — every audit record attributable to a named individual
- `src/app/login/` — a form collecting email addresses and passwords

None of it ran. All of it would have had to be declared in a data
protection review, and any of it could have been switched on by setting two
environment variables. Deleting it means the "no personal data" claim in §2
is now verifiable by reading the code rather than by reasoning about which
branches are reachable.

---

## 7. Bottom line

**Is it Saudi-law compliant?** For PDPL, yes — and by a wide margin, because
the app was designed around not collecting personal data rather than around
protecting it after collection. The three open items are documents, not
defects, and §5.1–5.4 closes them in about two hours.

**Residency is settled** (§4): the data is not sensitive and may be stored
outside the Kingdom, so hosting is an engineering choice rather than a
compliance one. The thing that keeps it settled is the no-personal-data
rule — it is what makes the determination true, so it is enforced in the
schema and the UI rather than left to discipline.

---

### Sources

- [SDAIA — Laws and Regulations](https://sdaia.gov.sa/en/SDAIA/about/Pages/RegulationsAndPolicies.aspx)
- [Clyde & Co — Enforcement of the Saudi PDPL is live](https://www.clydeco.com/en/insights/2026/03/enforcement-of-the-saudi-pdp-law)
- [Clyde & Co — Implementing Regulations to the PDPL](https://www.clydeco.com/en/insights/2023/09/saudi-arabia-issues-implementing-regulations)
- [Global Privacy Blog — Active enforcement of the Saudi privacy regime](https://www.globalprivacyblog.com/2026/05/active-enforcement-of-saudi-arabia-privacy-regime-implications-for-businesses/)
- [Chambers — Data Protection & Privacy 2026, Saudi Arabia](https://practiceguides.chambers.com/practice-guides/data-protection-privacy-2026/saudi-arabia)
- [King & Spalding — International personal data transfers under the PDPL](https://www.kslaw.com/news-and-insights/international-personal-data-transfers-under-saudi-arabias-data-protection-law)
- [HFW — Cross-border data transfers in KSA: SCCs vs binding common rules](https://www.hfw.com/insights/cross-border-data-transfers-in-ksa-standard-contractual-clauses-vs-binding-common-rules/)
- [NCA — Cloud Cybersecurity Controls](https://nca.gov.sa/en/regulatory-documents/controls-list/ccc/)
- [NCA — Essential Cybersecurity Controls](https://nca.gov.sa/en/regulatory-documents/controls-list/ecc/)
- [SDAIA/NDMO — National Data Governance Interim Regulations](https://sdaia.gov.sa/ndmo/Files/PoliciesEn.pdf)
