-- ---------------------------------------------------------------------------
-- 0005 — what the app grew after 0001 was written
--
-- Three things, each the storage for a decision taken in the app since:
--
--   1. SCOPED RESPONSES. 0001 modelled one checklist. The programme is five
--      audits and EIGHTEEN checklists — Health & Safety, Environment,
--      Security, Worker Welfare, and one per entry in the critical-risk
--      register, combined into the CRC discipline score. `audit_responses`
--      holds Health & Safety; everything else needs a scope beside the
--      question code.
--
--   2. ACTIONS. "And what are we doing about it?" had no answer anywhere.
--      An action's owner is a FUNCTION, never a person: it derives from the
--      issue categories, which already name one. There is no assignee
--      column here and there must never be one — see the constraint note.
--
--   3. AUDIT EVENTS. Nothing recorded who changed what. This records the
--      ROLE and the change, not a name, which keeps the hosting
--      determination in docs/COMPLIANCE-KSA.md §4 intact. The column for a
--      person's identity is deliberately absent until that question is
--      answered; see 0006.
--
-- Safe to run against a database created by 0001-0004. Idempotent.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. Scoped responses — the other seventeen checklists
-- ---------------------------------------------------------------------------

create table if not exists audit_scope_responses (
  audit_id      uuid not null references audits (id) on delete cascade,
  -- 'env', 'sec', 'ww', or 'crc:<critical_risk_id>'. Health & Safety is NOT
  -- stored here: it stays in audit_responses, which every existing view,
  -- the recurrence machinery and every record already written depend on.
  scope_id      text not null check (scope_id <> 'hs'),
  question_code text not null,
  answer        text not null check (answer in ('full', 'partial', 'no', 'na')),
  primary key (audit_id, scope_id, question_code)
);
comment on table audit_scope_responses is
  'Answers for every checklist OTHER than Health & Safety. One row per '
  'question answered; an unanswered question has NO ROW, so it is ignored '
  'by the scoring rather than counted as No — the same rule as '
  'audit_responses, which this deliberately mirrors.';
comment on column audit_scope_responses.scope_id is
  'The checklist this answer belongs to: a discipline id, or crc:<hazard> '
  'for one of the fourteen critical-risk checklists. No foreign key: the '
  'scope registry lives in code (src/lib/ehss/scopes.ts) because a '
  'checklist is a deployment, not a row.';

create table if not exists audit_scope_response_issues (
  audit_id      uuid not null,
  scope_id      text not null,
  question_code text not null,
  issue_code    text not null references issue_categories (code) on delete restrict,
  primary key (audit_id, scope_id, question_code, issue_code),
  foreign key (audit_id, scope_id, question_code)
    references audit_scope_responses (audit_id, scope_id, question_code)
    on delete cascade
);
comment on table audit_scope_response_issues is
  'Why the requirement was not met, for a non-H&S checklist. SEVERAL MAY '
  'APPLY, so any count over this table sums to more than the number of '
  'findings. That is the model, not a bug to fix by dropping categories.';

create index if not exists audit_scope_responses_by_scope
  on audit_scope_responses (scope_id, answer);

-- ---------------------------------------------------------------------------
-- 2. Actions — and the rule that there is no person in them
-- ---------------------------------------------------------------------------

create table if not exists actions (
  id              uuid primary key default gen_random_uuid(),
  contractor_id   text not null references contractors (id) on delete cascade,
  -- What it was raised against: a checklist area, or a critical-risk hazard.
  target_kind     text not null check (target_kind in ('area', 'risk')),
  target_code     text not null,
  -- Stored, not joined: a renamed area must not orphan the history of what
  -- an action was raised against.
  target_label    text not null,
  raised_quarter  text not null check (raised_quarter ~ '^\d{4}-Q[1-4]$'),
  target_quarter  text not null check (target_quarter ~ '^\d{4}-Q[1-4]$'),
  -- A hand closure ONLY. Closure by evidence is DERIVED from a later
  -- review and is never written here — see the comment below.
  closed_by_hand_quarter text
    check (closed_by_hand_quarter ~ '^\d{4}-Q[1-4]$'),
  closed_by_hand_reason  text
    check (closed_by_hand_reason in ('out-of-scope', 'superseded')),
  created_at      timestamptz not null default now(),
  constraint action_target_after_raise
    check (target_quarter > raised_quarter),
  constraint action_hand_closure_complete
    check ((closed_by_hand_quarter is null) = (closed_by_hand_reason is null))
);
comment on table actions is
  'What is being done about a finding. THERE IS NO ASSIGNEE COLUMN AND '
  'THERE MUST NEVER BE ONE. The owner is a FUNCTION, derived from the '
  'issue categories in action_causes, which already name one. A name here '
  'would make this personal data under PDPL and void the hosting '
  'determination in docs/COMPLIANCE-KSA.md §4 — and a role is the better '
  'model anyway, because people move between quarters and roles do not.';
comment on column actions.closed_by_hand_quarter is
  'CLOSURE IS NORMALLY DERIVED, NOT STORED. An action closes when a LATER '
  'finalized review scores its target at or above target, and that is '
  'computed on read so the register cannot show closed for something the '
  'next review found open again. These two columns record only a manual '
  'close, which reads as "closed without evidence" — a different claim.';
comment on constraint action_target_after_raise on actions is
  'A quarterly programme cannot verify anything sooner than its next '
  'review, so an action cannot be due in the quarter that raised it.';

create table if not exists action_causes (
  action_id  uuid not null references actions (id) on delete cascade,
  issue_code text not null references issue_categories (code) on delete restrict,
  primary key (action_id, issue_code)
);
comment on table action_causes is
  'Why, from the fixed category list — and therefore WHO owns it. At least '
  'one is required in the app: an action with no cause names nobody and '
  'asks for nothing. There is no free-text column, here or anywhere: a '
  'notes box is how an audit tool acquires personal data by accident.';

create index if not exists actions_by_contractor
  on actions (contractor_id, raised_quarter);

-- ---------------------------------------------------------------------------
-- 3. The audit trail — role, not name
-- ---------------------------------------------------------------------------

create table if not exists audit_events (
  id          bigserial primary key,
  occurred_at timestamptz not null default now(),
  -- WHO, as far as this schema is allowed to go today: the role that acted.
  -- A subject id belongs here only once the DPO has answered whether an
  -- opaque identifier changes the §4 determination. 0006 is where that
  -- goes, if the answer permits it.
  actor_role  text not null check (actor_role in ('admin', 'auditor', 'viewer')),
  -- WHAT changed.
  entity      text not null,
  entity_id   text not null,
  field       text not null,
  old_value   text,
  new_value   text
);
comment on table audit_events is
  'Who changed what, when. ROLE ONLY — no name, no email, no user id. An '
  'audit tool without a trail cannot answer the first question a dispute '
  'raises, and a trail with a person''s name in it changes which laws '
  'apply to this system. This is the version that is safe to build now; '
  'see docs/FIX-PLAN.md for the decision that gates the rest.';
comment on column audit_events.old_value is
  'Rendered as text rather than typed per entity: the trail is read by '
  'people, not joined by queries, and a value that cannot be stored is a '
  'change that goes unrecorded.';

create index if not exists audit_events_by_entity
  on audit_events (entity, entity_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- RLS, matching 0001: on for every table, authenticated-only.
-- The trail is INSERT and SELECT only — a trail anyone can edit is not one.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'audit_scope_responses', 'audit_scope_response_issues',
    'actions', 'action_causes'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format(
      'create policy %I on %I for select to authenticated using (true)',
      t || '_read', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      t || '_write', t);
  end loop;
end $$;

alter table audit_events enable row level security;
drop policy if exists audit_events_read on audit_events;
create policy audit_events_read on audit_events
  for select to authenticated using (true);
drop policy if exists audit_events_append on audit_events;
create policy audit_events_append on audit_events
  for insert to authenticated with check (true);
-- Deliberately NO update or delete policy. A trail that can be rewritten
-- is a trail that proves nothing.

commit;
