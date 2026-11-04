-- ---------------------------------------------------------------------------
-- 0006 — "what was seen": the one free-text field in the audit
--
-- READ docs/COMPLIANCE-KSA.md §2 AND §4 BEFORE TOUCHING ANYTHING HERE.
--
-- Until 2026-10-18 this schema had no free-text column anywhere in the
-- scoring path, and §2 called that absence "structural, not a policy someone
-- has to remember". A director looking at an area scored 18.2% had the
-- number, the cause categories and nothing they could take to the contractor,
-- so the owner asked for the auditor's own description (instruction,
-- 2026-10-18) and §4 was re-affirmed on the strength of four controls.
--
-- THE FOUR CONTROLS. All of them are load-bearing; this migration carries the
-- two the database can enforce.
--
--   1. It describes a CONDITION, and hangs off a question or an area — never
--      off a person. There is no worker table, no assignee, no actor name,
--      and 0005's note about never adding one stands unchanged.
--   2. It is CAPPED. 300 characters is an observation; past that it is a
--      narrative, and a narrative is where names appear. Enforced here as a
--      check constraint, not left to the client.
--   3. It is VALIDATED AT ENTRY. `noteProblem()` in src/lib/ehss/model.ts
--      refuses an email, a phone number, an iqama or passport reference, or
--      an honorific followed by a name. The database cannot reasonably
--      re-implement that, so the application owns it — which is exactly why
--      the cap below is enforced where it CAN be.
--   4. It is OUTSIDE THE SCORING PATH. Nothing reads it to compute a figure.
--      Note that no scoring view or function references these columns, and
--      if one ever does, that is the change that re-opens §4 again.
--
-- What is still absent, and must stay absent: photographs, attachments, any
-- upload path, free text on an action, free text on an audit event.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Per question — Health & Safety, and the other seventeen checklists
-- ---------------------------------------------------------------------------

alter table audit_responses
  add column if not exists note text
    constraint audit_response_note_length check (char_length(note) <= 300);

comment on column audit_responses.note is
  'What the auditor saw, optional, 300 characters. The condition, never the '
  'person: see the header of migration 0006 and COMPLIANCE-KSA §2/§4. '
  'Nothing computes from this column and nothing should.';

alter table audit_scope_responses
  add column if not exists note text
    constraint audit_scope_response_note_length check (char_length(note) <= 300);

comment on column audit_scope_responses.note is
  'As audit_responses.note, for the other seventeen checklists.';

-- ---------------------------------------------------------------------------
-- 2. Per area — the grain today's data actually has
--
-- Every review on record carries area points and no per-question answers
-- (the source sheets kept a narrative per question with nothing
-- machine-readable in it), so an area is the only place an observation can
-- attach to an imported quarter. Its own table rather than a column on
-- audit_area_scores: an area can be observed without being scored, and a row
-- deleted because its points were cleared must not take the note with it.
-- ---------------------------------------------------------------------------

create table if not exists audit_area_notes (
  audit_id  uuid not null references audits (id) on delete cascade,
  area_code text not null,
  note      text not null
    constraint audit_area_note_length check (char_length(note) <= 300),
  primary key (audit_id, area_code)
);

comment on table audit_area_notes is
  'What the auditor saw in a checklist area — "A", "B1".."B12", "C1", "C2". '
  'Separate from audit_area_scores because an area can be observed without '
  'being scored, and because clearing points must never delete the '
  'observation that explains them.';

-- ---------------------------------------------------------------------------
-- 3. Row-level security — same posture as every other audit table
-- ---------------------------------------------------------------------------

alter table audit_area_notes enable row level security;

drop policy if exists audit_area_notes_read on audit_area_notes;
create policy audit_area_notes_read on audit_area_notes
  for select to authenticated using (true);

drop policy if exists audit_area_notes_write on audit_area_notes;
create policy audit_area_notes_write on audit_area_notes
  for all to authenticated using (true) with check (true);
