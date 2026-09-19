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

### Deliberately absent

No worker records. No names, ID or Iqama numbers, passports,
nationalities, salaries or wage data. No photographs, attachments or
document store. No auditor contact details. No free-text field anywhere in
the scoring path. No analytics, telemetry or third-party trackers. No
cookies other than the one above.

**Why this holds under change:** the absence is structural, not a policy
someone has to remember. Answers are enums; comments are codes from a fixed
list; there is no upload path. The most common way an audit tool acquires
personal data — a free-text "comments" box or a site photograph — does not
exist here. Keep it that way and the compliance position does not drift.

---

## 3. Assessment against PDPL

| PDPL obligation | Status | Reasoning |
|---|---|---|
| Lawful basis for processing (Art. 5–6) | ✅ | The only personal data is a self-supplied display name used to render the session. Legitimate interest; no sensitive categories involved |
| Data minimization (Art. 10) | ✅ **Exemplary** | One optional free-text name. The architecture actively prevents collecting more |
| Sensitive personal data (Art. 1, 16) | ✅ N/A | None processed. Health data in this app is *organizational* H&S performance, not any individual's health |
| Privacy notice / transparency (Art. 12) | ⚠️ **Gap** | `/welcome` asks for a name without saying what happens to it. **Fix in §5.1** |
| Consent & withdrawal (Art. 5, 11) | ✅ | Providing the name is voluntary; "Restart demo" deletes it |
| Right of access, correction, destruction (Art. 4) | ✅ | The visitor holds the only copy and can change or delete it at any time, unilaterally |
| 30-day response to data subject requests | ✅ N/A | No stored records to respond about |
| Records of Processing Activities (Art. 31) | ⚠️ **Gap** | Required of controllers. **This document serves as the RoPA entry — §2 is the record.** Register it with NEOM's DPO |
| Breach notification, 72 h to SDAIA | ⚠️ **Gap** | No documented procedure. Low exposure — a breach of this app exposes no personal data — but the procedure must exist. **§5.4** |
| Data Protection Officer | ℹ️ | NEOM-level appointment, not app-level. Confirm the app is in the DPO's register |
| Cross-border transfer (Art. 29) | ✅ *currently* | No personal data is transferred: the cookie never leaves the browser. **This changes the moment a database is added — see §4** |
| Registration on the National Data Governance Platform | ℹ️ | NEOM-level obligation; confirm this system is listed |

**PDPL verdict: compliant.** Three documentation gaps, no code defects.

---

## 4. The one that actually matters: hosting and residency

This is where the real exposure sits, and it is **not a PDPL question**.

Today the app is a demo: the dataset is generated, contractor names come
from the scorecard, and nothing real is stored. It can be hosted anywhere.

**The moment it carries real Oxagon audit results, the picture changes.**
Contractor EHSS performance — who is failing, on what, and by how much — is
NEOM operational data. Under the NDMO framework that is almost certainly
**Confidential**, and government data must remain inside the Kingdom unless
specific authorized conditions are met. A Vercel deployment on US or EU
infrastructure does not meet them by default.

This is a **hosting decision, not a code change**. The application is a
standard Next.js build with no managed-platform dependencies, so it moves
without modification.

**Recommended order of operations:**

1. Get the data classification from NEOM's data office **before** choosing
   where production runs. Everything else follows from that answer.
2. If Confidential or above: host inside KSA. Options include a NEOM-approved
   private cloud, or an in-Kingdom region of a CST-licensed provider
   (Google Cloud Dammam, Oracle Jeddah, AWS KSA, STC/stc cloud). The
   database goes in the same region.
3. If it stays outside KSA even temporarily, that transfer needs a
   documented Transfer Risk Assessment plus an approved mechanism
   (Standard Contractual Clauses or Binding Common Rules) — **and the
   transfer must be limited to the minimum data necessary.**
4. Confirm whether NCA ECC/CCC applies through NEOM's cybersecurity
   function. If it does, the cloud tenant controls (CCC-2:2024) apply to
   NEOM as the tenant, not to this codebase.

**The cheapest compliant path — and my recommendation:** keep the public
Vercel deployment as the *demo* with generated data only, clearly labelled,
and stand up a separate in-Kingdom instance for real audit data. Same
codebase, two deployments, no rewrite. You get to keep showing the tool to
stakeholders on a public URL while the real data never leaves the Kingdom.

---

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

### 5.3 Classification banner — *~30 minutes*
Once NEOM assigns a classification, display it in the header of the real
deployment ("NEOM — Confidential"). NDMO expects classified data to be
marked; it also stops anyone screenshotting it into a WhatsApp group
without noticing.

### 5.4 Breach-response note — *~30 minutes, documentation only*
Half a page: who is notified, the 72-hour SDAIA clock, and who contacts
the DPO. Keep it next to this file.

### 5.5 Register with NEOM's DPO — *one email*
Send this document. §2 is your Record of Processing Activities.

### 5.6 Confirm classification and hosting — *the long pole, start now*
§4. Blocks production, not development. Start the conversation before the
database work, because the answer determines where the database goes.

### 5.7 When the database is added — *design-time constraints*
- Keep the no-personal-data rule at the **schema** level: no worker table,
  no free-text column in the scoring path, no attachment storage.
- Auditor identity: store an opaque user id, not a name, in audit records.
  If auditors need to be identifiable, that is a deliberate scope change
  requiring a lawful basis and a retention period — not a default.
- Database region must match the hosting decision from §4.
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
defects, and §5.1–5.5 closes them in about two hours.

**The real constraint is residency**, and it is not a legal problem with the
software — it is a decision about where production runs, which needs
NEOM's data classification to answer. Start that conversation now; it is
the only item on this list with a lead time.

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
