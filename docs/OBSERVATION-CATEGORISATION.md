<!-- How the observation causes were assigned. Used as the brief for a Claude
pass over batch files you create (a JSON array of { id, kind, questionCode, text },
one file per batch, a few hundred observations each). The outputs of that pass
and the rewrites file are NOT committed: they hold name spans. -->

# Categorising audit observations

You are reading real Health & Safety audit observations from contractor audits
on a Saudi construction programme. For each observation in your batch file,
decide three things and write them to your output file.

## Input
A JSON array of `{ id, kind, questionCode, text }`.
- `kind` is what the source sheet's row label implied: `gap` (a row under a
  checklist question), `positive` (a row labelled positive), `site` (a "Site /
  Other Findings" row). The label is NOT always right — see "kind" below.
- `questionCode` is the checklist question (A1–A15 management, B1.x–B12.x on
  site, C1.x–C2.x planning and leadership), or null.

## Output
Write ONE JSON object to your output file, keyed by id, covering EVERY id in
your batch exactly once:

```json
{ "<id>": { "causes": ["DOC", "IMP"], "nameFlag": false } }
```

Add `"kind": "positive"` or `"kind": "gap"` ONLY when you are correcting the
sheet's kind (see below). Add `"nameSpans": ["…"]` only when `nameFlag` is
true: the exact substrings of `text` that identify a person.

## causes
The seven causes (definitions in `src/lib/ehss/issues.ts`, summarised below) answer WHY a requirement was not met:

- DOC Documentation: the plan, permit, certificate or record does not exist, is not approved, or has expired.
- PLN Planning: the work began without being planned, risk-assessed or sequenced.
- IMP Implementation: it exists on paper and is not happening in the field.
- CMP Competence: people are not trained, qualified or formally appointed for the task.
- SUP Supervision: no one is overseeing the work, or the supervisor is not enforcing.
- RES Resources: equipment, PPE, facilities or people were not provided.
- LED Leadership: management is not engaged, not reviewing, not following up.

Rules:
- A gap or site observation gets ONE to THREE causes, most important first.
  Pick what the text actually says went wrong; do not pad.
- A cause is WHY, never WHERE. A missing subcontractor assessment is DOC even
  though it sits in the subcontractor area; an unguarded edge on site is IMP
  (or RES if the barrier was never supplied), not "site".
- A positive observation gets exactly `["GOOD"]`.
- Never put GOOD on a gap.

## kind (correcting the sheet's label)
- A row under a checklist question often records that the requirement WAS met
  ("Compliant", "Yes, there is…", "approved with code A", "available and
  verified"). If the text says the requirement is met with no shortfall, set
  `"kind": "positive"` and causes `["GOOD"]`.
- If the text records any shortfall (even beside something that is in place),
  it stays a gap with its causes.
- A row labelled positive whose text plainly describes a failure or unsafe
  condition: set `"kind": "gap"` with its causes.
- Pure cross-references or not-applicable notes with no finding of their own
  ("Addressed in A9", "Refer to B6", "N/A – no oxy-fuel at the time of
  audit"): keep the sheet kind, give `"causes": []` and add
  `"note": "reference"`. These are reviewed by hand.

## nameFlag — the most important field
`true` when the text still names or identifies an individual person, with or
without a title: a forename and surname ("Ahmed Saleh was operating…"), a
single given name used for a person, a name next to a job title ("the
electrician Ravi Kumar"), an ID-card or iqama number. Titled names have
already been replaced with "a worker", so most texts are clean — look hard at
capitalised word pairs near job words (operator, electrician, foreman,
supervisor, rigger, driver, manager, engineer, officer).

NOT a person: company names, contractor names (ABYATONA, AL FAHD, SIBS, PPCO,
NBC, RPCO, TDP, ECH, SD, OT2…), product names, place and building names,
document numbers, role titles without a name ("the HSE Manager").

Never repeat any name you find anywhere except inside `nameSpans`.

## Finish
Validate your file before finishing: it parses as JSON, has every batch id
exactly once, every cause is one of DOC PLN IMP CMP SUP RES LED GOOD, every
positive (after correction) is exactly ["GOOD"], every gap/site has 1–3 causes
unless it carries `"note": "reference"`. Run a short `python3 -I -c` check and
fix anything it finds. Then reply with one line:
`batch NN: <n> ids, <g> gap, <p> positive, <s> site, <k> kind corrections, <f> name flags, <r> references`.
