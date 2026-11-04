# Saudi law compliance — assessment and remediation

**Scope:** the EHSS contractor audit dashboard in this repository.
**Assessed:** September 2026, against the app as it stands on this branch.
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
- **"What was seen"** — the auditor's description of a condition, against a
  checklist question, a checklist area or a critical-risk hazard. Optional,
  300 characters, and refused at entry if it looks like it names anybody
  (see below). It describes a *site condition*, not a person, which is what
  keeps it on this side of the line rather than in the table above.

### Deliberately absent

No worker records. No names, ID or Iqama numbers, passports,
nationalities, salaries or wage data. No photographs, attachments or
document store. No auditor contact details. No analytics, telemetry or
third-party trackers. No cookies other than the one above. **Nothing
free-text in the scoring path** — no figure anywhere is computed from
typed text.

**Why this holds under change.** Two different mechanisms, and the
difference matters:

- **Structural, for everything that could name a person.** There is no
  worker table, no assignee field on an action, no actor name on an audit
  event, and no upload path. Tests assert the absence of each
  (`actions.test.ts`, `trail.test.ts`), so it cannot be added by accident.
- **Enforced at entry, for the one description field.** Until 2026-10-18
  the absence of a free-text box was structural too. A director looking at
  an area scored 18.2% had the number, the cause categories, and nothing
  they could take to the contractor, so the owner asked for the auditor's
  own description. It is capped at 300 characters, kept out of the scoring
  path, and `noteProblem()` in `src/lib/ehss/model.ts` **refuses to save**
  an email address, a phone number, an iqama/passport/ID reference, or an
  honorific followed by a name. The rule is printed under the field as
  well, because a check nobody understands gets routed around.

That second mechanism is weaker than the first, and it is the only place in
the app that relies on it. Keep it the only place and the position holds.

---

## 3. Assessment against PDPL

| PDPL obligation | Status | Reasoning |
|---|---|---|
| Lawful basis for processing (Art. 5–6) | ✅ | The only personal data is a self-supplied display name used to render the session. Legitimate interest; no sensitive categories involved |
| Data minimization (Art. 10) | ✅ **Strong** | One optional free-text name, plus one capped, validated description field that records conditions rather than people. The architecture still prevents collecting more |
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

**Reviewed 2026-10-18 and re-affirmed.** An optional "what was seen" field
was added to the audit record on the owner's instruction, which §4 item 4
below requires be treated as a scope change rather than a feature. The
determination stands, on four controls, all of which must remain true:

1. It records a **condition**, and attaches to a checklist question, a
   checklist area or a critical-risk hazard — never to a person. No field
   in this system points at an individual, and the tests that assert that
   are unchanged. (The hazard grain was added 2026-11-04 under the same
   four controls; it is a third place the same field appears, not a new
   kind of field.)
2. It is **capped** at 300 characters, in the client, in the validator and
   in the database constraint. Past that it is a narrative, and a narrative
   is where names appear.
3. It is **validated at entry** and the save is blocked, not warned:
   `noteProblem()` refuses an email, a phone number, an
   iqama/passport/ID/badge reference, or an honorific followed by a name.
4. It is **outside the scoring path**. No figure is derived from it. The
   audit trail records that it changed and by which role, never its text.

If any of those four stops being true, this section is re-opened again.

That determination rests on what §2 describes, so it holds only while those
facts hold:

- **No personal data beyond an optional display name.** The moment a field
  names a worker, an auditor or any other individual, this is personal data
  under PDPL and the cross-border rules in §1 apply again. That is why the
  no-personal-data rule in `CLAUDE.md` is an invariant and not a preference.
- **Contractor-level results only.** Organizational audit scores, not
  individual performance.
- **No uploads, and one controlled description field.** A site photograph
  is how an audit tool acquires personal data by accident, and there is no
  upload path at all. The auditor's "what was seen" is the single free-text
  field: capped, outside the scoring path, attached to a question or an
  area rather than to anybody, and refused at entry when it looks like an
  identifier. See §2 and the 2026-10-18 review below.
- **Contractors are identified only by initials and the last three digits of
  the work order** — `SIBS (838)`, `AF (272)`. Applied when the real Q4 2025
  and Q1 2026 audits were imported (owner's instruction, 2026-10-07): full
  work orders and names as typed stay in `data/`, outside `src/`, so they are
  not bundled into the client. The imported audits also carry **no auditor
  names or mobile numbers** — row 3 of every sheet block was deliberately not
  read (`scripts/import-hs-audit.py`), because importing it would have put
  personal data in the app and broken both §2 and this section in one step.

**Design consequences, applied:**

1. Host anywhere. Vercel, or any managed platform, in any region.
2. The database, when added, may sit in any region. Pick on latency, cost
   and operational fit rather than residency.
3. No SCCs, Binding Common Rules or transfer assessment are needed for the
   data as scoped.
4. **Re-open this section if the scope changes.** Adding worker records,
   named auditors, photographs or free text does not merely add a feature —
   it changes which laws apply and where the system may run.

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
  no free-text column in the scoring path (the one
  description column is `audit_responses.note` and its siblings — length
  constrained in the schema, and read by no view that computes a figure), no attachment storage.
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
