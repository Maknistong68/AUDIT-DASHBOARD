-- EHSS quarterly audit platform — schema.
--
-- Run the files in this folder in order, in the Supabase SQL editor:
--   0001_schema.sql            tables, constraints, row-level security
--   0002_reference_data.sql    pillars, disciplines, bands, categories, hazards
--   0003_checklist.sql         the 81-question H&S checklist
--   0004_contractors.sql       sub-regions and the 13 contractors
-- then OPTIONALLY ../seed_audits_2025Q4_2026Q1.sql for the two real quarters.
--
-- TWO KINDS OF TABLE, and the split is the whole design:
--
--   REFERENCE — the checklist, the issue categories, the hazards, the
--   disciplines and their weights, the rating bands, the contractors. Set up
--   once, edited when the programme changes. Nothing here is compiled into
--   the app any more.
--
--   AUDIT — one row per quarterly review, plus its answers or its area
--   points. This is what gets entered each quarter.
--
-- TWO INVARIANTS, carried over from docs/COMPLIANCE-KSA.md. They are what
-- let this data be hosted outside the Kingdom, so they are schema rules, not
-- preferences:
--
--   1. NO PERSONAL DATA. There is no column anywhere for an auditor's name,
--      a phone number, a worker record or a photograph. Contractors are
--      initials plus the last three digits of the work order and nothing
--      more. Adding such a column does not just add a feature — it changes
--      which laws apply and where this database may run.
--   2. NO FREE TEXT in an audit. An answer is Full/Partial/No/N-A and the
--      reason is picked from issue_categories. There is deliberately no
--      comments column: a comments box is how an audit tool acquires
--      personal data by accident.

begin;

-- ===========================================================================
-- REFERENCE
-- ===========================================================================

create table if not exists shew_domains (
  id          text primary key,
  label       text not null,
  is_shew     boolean not null default true,
  description text
);
comment on table shew_domains is
  'Safety / Health / Environment / Welfare pillars, plus Security and a '
  'cross-cutting bucket. Tags questions and hazards.';

create table if not exists disciplines (
  id            text primary key,
  name          text not null,
  short_name    text not null,
  weight        numeric(4,3) not null check (weight > 0 and weight <= 1),
  has_checklist boolean not null default false
);
comment on column disciplines.weight is
  'Fraction of the overall score. The five currently sum to 1.0; the app '
  'renormalizes over whichever disciplines a review actually scored, so a '
  'quarter with only H&S is not understated.';

create table if not exists rating_bands (
  id        text primary key,
  label     text not null,
  min_score numeric(5,2) not null check (min_score >= 0 and min_score <= 100),
  shown_as  text not null
);
comment on table rating_bands is
  'A score takes the label of the highest band whose min_score it reaches.';

create table if not exists issue_categories (
  code        text primary key,
  label       text not null,
  description text not null,
  owner       text not null,
  is_gap      boolean not null default true,
  sort        integer not null default 0
);
comment on table issue_categories is
  'WHY a requirement was not met, which the checklist itself never says. '
  'Two rules hold the list together: every category implies a different fix '
  'and a different owner, and none is specific to one discipline. They are '
  'multi-select on a finding, so counts derived from them sum to more than '
  'the number of findings.';

create table if not exists critical_risks (
  id        text primary key,
  label     text not null,
  domain_id text not null references shew_domains (id),
  sort      integer not null default 0
);
comment on table critical_risks is
  'The Critical Risk Control hazardous-work register. A contractor is scored '
  'only on the hazards its scope involves; one out of scope is ABSENT, never '
  'zero.';

create table if not exists checklist_sections (
  code  text primary key,
  title text not null,
  sort  integer not null default 0
);

create table if not exists checklist_subsections (
  id           bigint generated always as identity primary key,
  section_code text not null references checklist_sections (code) on delete cascade,
  code         text unique,
  title        text,
  sort         integer not null default 0
);
comment on column checklist_subsections.code is
  'B1..B12, C1, C2. NULL for section A, whose questions sit directly in the '
  'section — section A is still a checklist AREA, keyed by the section code.';

create table if not exists checklist_questions (
  code            text primary key,
  section_code    text not null references checklist_sections (code) on delete cascade,
  subsection_code text references checklist_subsections (code) on delete set null,
  weight          integer not null check (weight > 0),
  question        text not null,
  domain_id       text not null references shew_domains (id),
  sort            integer not null default 0,
  retired_at      timestamptz
);
comment on column checklist_questions.retired_at is
  'Set instead of deleting a question that is no longer asked. Deleting it '
  'would take its answers with it and break every trend that spans the '
  'change.';

create table if not exists sub_regions (
  id   text primary key,
  name text not null
);

create table if not exists contractors (
  id            text primary key,
  code          text not null,
  name          text not null,
  sub_region_id text not null references sub_regions (id),
  active        boolean not null default true,
  constraint contractors_name_is_initials check (char_length(name) <= 8),
  constraint contractors_code_is_short    check (char_length(code) <= 4)
);
comment on table contractors is
  'Initials plus the last three digits of the work order — "SIBS" / "838". '
  'The length checks are the compliance position made structural: a full '
  'company name or a full work order will not fit, and must not be made to.';
comment on column contractors.active is
  'False when the project completes. Keeps its history and its trends; drops '
  'out of the active league table and the quarterly review obligation.';

-- ===========================================================================
-- AUDITS
-- ===========================================================================

create table if not exists audits (
  id             uuid primary key default gen_random_uuid(),
  contractor_id  text not null references contractors (id) on delete restrict,
  quarter        text not null check (quarter ~ '^\d{4}-Q[1-4]$'),
  audit_date     date not null,
  inspection_no  text,
  status         text not null default 'draft'
                   check (status in ('draft', 'submitted', 'approved')),
  reported_total numeric(5,2),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint audits_one_per_contractor_per_quarter
    unique (contractor_id, quarter)
);
comment on constraint audits_one_per_contractor_per_quarter on audits is
  'The review is quarterly, so one per contractor per quarter. This is also '
  'the check that would have caught the Q4 2025 sheet, where one '
  'contractor''s figures were pasted under another''s name.';
comment on column audits.reported_total is
  'The total a source sheet stated, where one was transcribed. NOT a record '
  'and never a fallback: in the imported quarters it disagreed with that '
  'sheet''s own points in 18 of 19 audits. The score is always calculated.';

create table if not exists audit_area_scores (
  audit_id  uuid not null references audits (id) on delete cascade,
  area_code text not null,
  scored    numeric(6,2) not null check (scored >= 0),
  possible  numeric(6,2) not null check (possible > 0),
  primary key (audit_id, area_code),
  constraint area_score_within_weight check (scored <= possible)
);
comment on table audit_area_scores is
  'For an audit recorded as AREA points rather than per-question answers — '
  'a historical import. area_code is a section code (A) or a sub-section '
  'code (B6, C2). `possible` is the APPLICABLE weight, so it varies between '
  'audits as N/A questions drop out of it.';
comment on constraint area_score_within_weight on audit_area_scores is
  'The source sheet had one area scored 21.5 out of 21 possible, which the '
  'importer had to cap. The database refuses it outright.';

create table if not exists audit_responses (
  audit_id      uuid not null references audits (id) on delete cascade,
  question_code text not null references checklist_questions (code) on delete restrict,
  answer        text not null check (answer in ('full', 'partial', 'no', 'na')),
  primary key (audit_id, question_code)
);
comment on table audit_responses is
  'One row per question answered. An unanswered question has NO ROW — it is '
  'ignored by the scoring, not counted as No. N/A is excluded from both the '
  'numerator and the denominator.';

create table if not exists audit_response_issues (
  audit_id      uuid not null,
  question_code text not null,
  issue_code    text not null references issue_categories (code) on delete restrict,
  primary key (audit_id, question_code, issue_code),
  foreign key (audit_id, question_code)
    references audit_responses (audit_id, question_code) on delete cascade
);
comment on table audit_response_issues is
  'Why the requirement was not met. SEVERAL MAY APPLY — a finding usually '
  'has more than one cause, and forcing one label loses the rest. At least '
  'one gap category belongs on every Partial or No.';

create table if not exists audit_discipline_scores (
  audit_id      uuid not null references audits (id) on delete cascade,
  discipline_id text not null references disciplines (id) on delete restrict,
  score         numeric(5,2) not null check (score >= 0 and score <= 100),
  primary key (audit_id, discipline_id)
);
comment on table audit_discipline_scores is
  'A recorded score for a discipline that has no checklist yet. For Health & '
  'Safety a row here is a historical transcription and wins over the '
  'checklist total.';

create table if not exists audit_critical_risks (
  audit_id uuid not null references audits (id) on delete cascade,
  risk_id  text not null references critical_risks (id) on delete restrict,
  score    numeric(5,2) not null check (score >= 0 and score <= 100),
  primary key (audit_id, risk_id)
);
comment on table audit_critical_risks is
  'One row per hazard the contractor''s scope involves. A hazard out of '
  'scope has NO ROW, so it is excluded from the average rather than scored '
  'zero.';

create index if not exists audits_contractor_quarter_idx
  on audits (contractor_id, quarter);
create index if not exists audits_quarter_idx on audits (quarter);
create index if not exists audit_responses_question_idx
  on audit_responses (question_code);
create index if not exists audit_response_issues_issue_idx
  on audit_response_issues (issue_code);

-- Keep updated_at honest without the app having to remember.
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists audits_set_updated_at on audits;
create trigger audits_set_updated_at
  before update on audits
  for each row execute function set_updated_at();

-- ===========================================================================
-- ROW LEVEL SECURITY
--
-- Supabase exposes every table over the public API, so RLS is not optional:
-- without it, anyone holding the anon key can read and rewrite the lot.
-- The default below is READ FOR ANYONE SIGNED IN, WRITE FOR ANYONE SIGNED
-- IN. That is deliberately simple, and it is NOT a permission model: it does
-- not distinguish an auditor from a director. Tighten it when you decide who
-- may enter an audit — see the note at the bottom of this file.
-- ===========================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'shew_domains', 'disciplines', 'rating_bands', 'issue_categories',
    'critical_risks', 'checklist_sections', 'checklist_subsections',
    'checklist_questions', 'sub_regions', 'contractors', 'audits',
    'audit_area_scores', 'audit_responses', 'audit_response_issues',
    'audit_discipline_scores', 'audit_critical_risks'
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

commit;

-- ---------------------------------------------------------------------------
-- BEFORE YOU GO LIVE
--
-- 1. The policies above require a signed-in user. If you are setting up by
--    hand before auth exists, you can let the anon key read and write — but
--    that means ANYONE WITH THE KEY CAN REWRITE EVERY AUDIT, and the key
--    ships in the browser. Use it only while the project is private, and
--    remove it before anyone outside the team has the URL:
--
--      do $$ declare t text; begin
--        foreach t in array array['shew_domains','disciplines','rating_bands',
--          'issue_categories','critical_risks','checklist_sections',
--          'checklist_subsections','checklist_questions','sub_regions',
--          'contractors','audits','audit_area_scores','audit_responses',
--          'audit_response_issues','audit_discipline_scores',
--          'audit_critical_risks']
--        loop
--          execute format('create policy %I on %I for all to anon using (true) with check (true)', t || '_anon', t);
--        end loop;
--      end $$;
--
-- 2. Decide who may ENTER an audit versus only read one. Until then every
--    signed-in person can approve and delete anything.
--
-- 3. SCORING IS NOT IN THIS DATABASE, on purpose. The weighted formula lives
--    in src/lib/ehss/scoring.ts with tests pinning it to the source workbook.
--    Implementing it again in SQL would create a second version to keep in
--    step, which is exactly the drift that put the spreadsheet 0.01 out from
--    the app. The database stores facts; the app scores them.
-- ---------------------------------------------------------------------------
