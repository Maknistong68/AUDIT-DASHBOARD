-- ---------------------------------------------------------------------------
-- 0007 — "what was seen", per critical-risk hazard
--
-- 0006 gave the audit its one free-text field at two grains: a checklist
-- QUESTION and a checklist AREA. This adds the third, and the reasoning in
-- 0006's header applies here unchanged — read it, and COMPLIANCE-KSA §2 and
-- §4, before touching anything in this file.
--
-- WHY A HAZARD NEEDS ITS OWN TABLE. Critical Risk Control is a focus audit
-- of fourteen hazards, each with its own checklist, and thirteen of those
-- checklists are still to be supplied. Until they are, a hazard carries a
-- score and an in-scope decision and has no questions to hang an
-- observation off — exactly the position a Health & Safety area is in for
-- every review imported so far. Once a hazard's checklist exists, its
-- per-question notes land in audit_scope_responses.note (scope_id
-- 'crc:<hazard>'), which 0006 already created.
--
-- Separate from the hazard's score for the same reason audit_area_notes is
-- separate from audit_area_scores: in the application, criticalRisks[id] is
-- both the score AND the in-scope flag, so a note stored beside it would be
-- deleted by the arithmetic that drops an out-of-scope hazard.
--
-- The four controls from 0006 hold here too, and the two the database can
-- enforce are enforced: the row keys on a hazard, never on a person, and
-- the text is capped at 300 characters. Entry validation (noteProblem) and
-- "nothing computes from it" remain the application's to keep.
-- ---------------------------------------------------------------------------

create table if not exists audit_risk_notes (
  audit_id uuid not null references audits (id) on delete cascade,
  risk_id  text not null references critical_risks (id) on delete restrict,
  note     text not null
    constraint audit_risk_note_length check (char_length(note) <= 300),
  primary key (audit_id, risk_id)
);

comment on table audit_risk_notes is
  'What the auditor saw against one critical-risk hazard. The CRC '
  'discipline''s equivalent of audit_area_notes, and separate from the '
  'hazard score so that taking a hazard out of scope cannot delete the '
  'observation that explains it.';

comment on column audit_risk_notes.risk_id is
  'A critical_risks id — ''fire'', ''height'', ''water'' … Keyed the same '
  'way audit_critical_risks is, and restricted against the same register, '
  'so a note cannot outlive the hazard it describes.';

-- ---------------------------------------------------------------------------
-- Row-level security — same posture as every other audit table
-- ---------------------------------------------------------------------------

alter table audit_risk_notes enable row level security;

drop policy if exists audit_risk_notes_read on audit_risk_notes;
create policy audit_risk_notes_read on audit_risk_notes
  for select to authenticated using (true);

drop policy if exists audit_risk_notes_write on audit_risk_notes;
create policy audit_risk_notes_write on audit_risk_notes
  for all to authenticated using (true) with check (true);
