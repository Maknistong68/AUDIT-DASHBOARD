-- GENERATED FILE — do not edit. Regenerate with scripts/build-setup-sql.sh
-- Applies the full schema + seed in one shot (Supabase Dashboard SQL Editor).
-- Safe on a FRESH project only: migrations are not idempotent.

-- ============================================================
-- supabase/migrations/0001_schema.sql
-- ============================================================
-- 0001_schema.sql
-- Core data model: contractors, audit types, questions, NC taxonomy,
-- audits, responses, and user profiles.
--
-- Design principles:
--   * No worker-level or personal data anywhere in the audit dataset.
--   * No free text in the scoring path — every scoring field is an enum or
--     a foreign key into a controlled vocabulary.
--   * Integrity is enforced in the database, not just the UI.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.audit_result as enum (
  'full_compliance',
  'non_compliance',
  'not_applicable'
);

-- Non-scoring observation layer, kept separate from the compliance result.
create type public.observation_type as enum (
  'positive_practice',
  'improvement_opportunity'
);

create type public.audit_status as enum (
  'draft',      -- auditor is still entering results; score is provisional
  'submitted',  -- auditor finished; visible to viewers; locked for auditors
  'approved'    -- admin verified; fully locked
);

create type public.corrective_action_status as enum (
  'open',
  'in_progress',
  'closed',
  'verified'
);

create type public.user_role as enum (
  'admin',    -- manages reference data, users, and all audits
  'auditor',  -- creates and edits own draft audits
  'viewer'    -- read-only access to submitted/approved audits and dashboards
);

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table public.contractors (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- short stable identifier, e.g. 'ABC'
  name        text not null unique,          -- organizational name only, never a person
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.audit_types (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- e.g. 'WMA'
  name        text not null unique,          -- e.g. 'Welfare Management Audit'
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Controlled NC taxonomy. Auditors pick from this list; they never type a reason.
create table public.nc_categories (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- e.g. 'NC-NA'
  name        text not null unique,          -- e.g. 'Documentation Not Available'
  description text,                          -- what the classification means
  sort_order  int  not null default 0,
  active      boolean not null default true
);

create table public.audit_questions (
  id            uuid primary key default gen_random_uuid(),
  audit_type_id uuid not null references public.audit_types (id),
  code          text not null,               -- e.g. 'WMP-01'
  category      text not null,               -- section grouping, e.g. 'Worker Management Plan'
  question      text not null,               -- the control statement
  weight        numeric(6,2) not null default 1.00 check (weight > 0),
  sort_order    int  not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (audit_type_id, code)
);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

-- Minimal profile row per Supabase Auth user. This is the only place the
-- application stores any personal data, and it is limited to the app's own
-- users (display name + role).
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        public.user_role not null default 'viewer',
  created_at  timestamptz not null default now()
);

-- Auto-provision a profile when a user signs up. New users start as 'viewer';
-- an admin promotes them explicitly.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Audits
-- ---------------------------------------------------------------------------

create table public.audits (
  id            uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors (id),
  audit_type_id uuid not null references public.audit_types (id),
  audit_date    date not null,
  status        public.audit_status not null default 'draft',
  auditor_id    uuid not null references public.profiles (id),
  -- Denormalized score (0-100), maintained by trigger in 0002_scoring.sql.
  -- NULL while the audit has no applicable responses.
  score         numeric(5,2) check (score >= 0 and score <= 100),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index audits_contractor_idx on public.audits (contractor_id, audit_date);
create index audits_type_idx       on public.audits (audit_type_id, audit_date);

create table public.audit_responses (
  id                       uuid primary key default gen_random_uuid(),
  audit_id                 uuid not null references public.audits (id) on delete cascade,
  question_id              uuid not null references public.audit_questions (id),
  result                   public.audit_result not null,
  nc_category_id           uuid references public.nc_categories (id),
  observation              public.observation_type,           -- optional, never affects score
  corrective_action_status public.corrective_action_status,   -- NC follow-up only
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (audit_id, question_id),

  -- An NC classification is mandatory for Non-Compliance and forbidden otherwise.
  constraint nc_category_iff_non_compliance check (
    (result = 'non_compliance') = (nc_category_id is not null)
  ),

  -- Corrective actions only exist for Non-Compliance responses.
  constraint corrective_action_only_for_nc check (
    corrective_action_status is null or result = 'non_compliance'
  )
);

create index audit_responses_audit_idx    on public.audit_responses (audit_id);
create index audit_responses_question_idx on public.audit_responses (question_id);
create index audit_responses_nc_idx       on public.audit_responses (nc_category_id)
  where nc_category_id is not null;

-- A response's question must belong to the audit's audit type
-- (cross-table rule, so enforced by trigger rather than CHECK).
create or replace function public.check_response_question_type()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  audit_type  uuid;
  question_type uuid;
begin
  select a.audit_type_id into audit_type
    from public.audits a where a.id = new.audit_id;
  select q.audit_type_id into question_type
    from public.audit_questions q where q.id = new.question_id;

  if audit_type is distinct from question_type then
    raise exception 'question % does not belong to the audit type of audit %',
      new.question_id, new.audit_id;
  end if;
  return new;
end;
$$;

create trigger audit_responses_question_type_check
  before insert or update of question_id, audit_id on public.audit_responses
  for each row execute function public.check_response_question_type();

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger audits_touch_updated_at
  before update on public.audits
  for each row execute function public.touch_updated_at();

create trigger audit_responses_touch_updated_at
  before update on public.audit_responses
  for each row execute function public.touch_updated_at();

-- ============================================================
-- supabase/migrations/0002_scoring.sql
-- ============================================================
-- 0002_scoring.sql
-- Scoring algorithm + analytics views.
--
-- Scoring rules (the four outcomes of the structured model):
--   Full Compliance -> weight counts fully
--   Non-Compliance  -> weight counts as zero
--   Not Applicable  -> excluded from both numerator and denominator
--   Observation     -> recorded separately (0001), never affects the score
--
--   score = sum(weight where full_compliance)
--         / sum(weight where result <> not_applicable) * 100
--
-- An audit with no applicable responses has score NULL (not 0).

-- ---------------------------------------------------------------------------
-- Scoring function + trigger (keeps audits.score denormalized and current)
-- ---------------------------------------------------------------------------

create or replace function public.calculate_audit_score(p_audit_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select round(
    sum(q.weight) filter (where r.result = 'full_compliance')
      / nullif(sum(q.weight) filter (where r.result <> 'not_applicable'), 0)
      * 100,
    2)
  from public.audit_responses r
  join public.audit_questions q on q.id = r.question_id
  where r.audit_id = p_audit_id;
$$;

create or replace function public.refresh_audit_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  target := coalesce(new.audit_id, old.audit_id);
  update public.audits
     set score = public.calculate_audit_score(target)
   where id = target;

  -- On UPDATE a response could in principle move between audits; refresh both.
  if tg_op = 'UPDATE' and new.audit_id is distinct from old.audit_id then
    update public.audits
       set score = public.calculate_audit_score(old.audit_id)
     where id = old.audit_id;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger audit_responses_refresh_score
  after insert or update or delete on public.audit_responses
  for each row execute function public.refresh_audit_score();

-- ---------------------------------------------------------------------------
-- Analytics views (the dashboard reads these, filtered client-side)
--
-- security_invoker: the querying user's RLS applies, so drafts stay hidden
-- from viewers exactly as the base-table policies dictate.
-- Views only include scoreable data from submitted/approved audits — drafts
-- are excluded so in-progress entry never skews the dashboard.
-- ---------------------------------------------------------------------------

-- One row per finalized audit: the base series for score trends.
create view public.v_audit_scores
  with (security_invoker = true)
as
select
  a.id            as audit_id,
  a.contractor_id,
  c.code          as contractor_code,
  c.name          as contractor_name,
  a.audit_type_id,
  t.code          as audit_type_code,
  t.name          as audit_type_name,
  a.audit_date,
  a.status,
  a.score
from public.audits a
join public.contractors c on c.id = a.contractor_id
join public.audit_types t on t.id = a.audit_type_id
where a.status in ('submitted', 'approved');

-- Latest finalized score per contractor per audit type (headline KPI tiles).
create view public.v_contractor_latest_scores
  with (security_invoker = true)
as
select distinct on (contractor_id, audit_type_id)
  contractor_id,
  contractor_code,
  contractor_name,
  audit_type_id,
  audit_type_code,
  audit_type_name,
  audit_date  as latest_audit_date,
  score       as latest_score
from public.v_audit_scores
order by contractor_id, audit_type_id, audit_date desc, audit_id desc;

-- NC breakdown: every Non-Compliance response with its classification.
-- Group by nc_category_name for "most common NC cause"; by contractor for
-- "ABC's main weakness"; by question_code for "weakest control".
create view public.v_nc_breakdown
  with (security_invoker = true)
as
select
  a.id             as audit_id,
  a.contractor_id,
  c.name           as contractor_name,
  a.audit_type_id,
  t.name           as audit_type_name,
  a.audit_date,
  q.id             as question_id,
  q.code           as question_code,
  q.category       as question_category,
  n.id             as nc_category_id,
  n.code           as nc_category_code,
  n.name           as nc_category_name,
  r.corrective_action_status
from public.audit_responses r
join public.audits          a on a.id = r.audit_id
join public.contractors     c on c.id = a.contractor_id
join public.audit_types     t on t.id = a.audit_type_id
join public.audit_questions q on q.id = r.question_id
join public.nc_categories   n on n.id = r.nc_category_id
where r.result = 'non_compliance'
  and a.status in ('submitted', 'approved');

-- Per-question compliance rate across finalized audits: which controls are
-- systematically weak, program-wide.
create view public.v_question_performance
  with (security_invoker = true)
as
select
  q.id       as question_id,
  q.audit_type_id,
  q.code     as question_code,
  q.category as question_category,
  q.question,
  count(*) filter (where r.result <> 'not_applicable')   as times_applicable,
  count(*) filter (where r.result = 'full_compliance')   as times_compliant,
  count(*) filter (where r.result = 'non_compliance')    as times_non_compliant,
  round(
    count(*) filter (where r.result = 'full_compliance')::numeric
      / nullif(count(*) filter (where r.result <> 'not_applicable'), 0) * 100,
    2)                                                   as compliance_rate
from public.audit_questions q
join public.audit_responses r on r.question_id = q.id
join public.audits          a on a.id = r.audit_id
where a.status in ('submitted', 'approved')
group by q.id;

-- Positive practices / improvement opportunities (non-scoring observations).
create view public.v_observations
  with (security_invoker = true)
as
select
  a.id           as audit_id,
  a.contractor_id,
  c.name         as contractor_name,
  a.audit_date,
  q.code         as question_code,
  q.category     as question_category,
  r.result,
  r.observation
from public.audit_responses r
join public.audits          a on a.id = r.audit_id
join public.contractors     c on c.id = a.contractor_id
join public.audit_questions q on q.id = r.question_id
where r.observation is not null
  and a.status in ('submitted', 'approved');

-- Open corrective actions (NC follow-up backlog).
create view public.v_open_corrective_actions
  with (security_invoker = true)
as
select *
from public.v_nc_breakdown
where corrective_action_status in ('open', 'in_progress');

-- ============================================================
-- supabase/migrations/0003_rls.sql
-- ============================================================
-- 0003_rls.sql
-- Roles and row-level security.
--
-- Role model (public.user_role on profiles):
--   admin    manages reference data, users, and every audit at any status
--   auditor  creates draft audits as themselves, edits them while draft,
--            then submits; cannot touch other auditors' drafts
--   viewer   read-only: sees submitted/approved audits and all dashboards
--
-- Draft audits are private to their auditor (and admins). Submitted and
-- approved audits are visible to every authenticated user.

-- ---------------------------------------------------------------------------
-- Role helper (security definer so it can read profiles without recursion)
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.current_user_role() = 'admin';
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.contractors     enable row level security;
alter table public.audit_types     enable row level security;
alter table public.audit_questions enable row level security;
alter table public.nc_categories   enable row level security;
alter table public.profiles        enable row level security;
alter table public.audits          enable row level security;
alter table public.audit_responses enable row level security;

-- ---------------------------------------------------------------------------
-- Grants
-- The audit dataset is internal: nothing is exposed to anon.
-- RLS below decides which rows each authenticated user can actually reach.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;

grant select on all tables in schema public to authenticated;

grant insert, delete on public.audits, public.audit_responses to authenticated;
grant update on public.audit_responses to authenticated;
-- Auditors may never write score (trigger-owned) or reassign auditor_id.
grant update (contractor_id, audit_type_id, audit_date, status)
  on public.audits to authenticated;

-- Reference data and profiles are admin-managed; admins are authenticated
-- users, so the grants must exist — RLS restricts them to the admin role.
grant insert, update, delete on
  public.contractors, public.audit_types, public.audit_questions,
  public.nc_categories, public.profiles
to authenticated;

-- ---------------------------------------------------------------------------
-- Reference data: readable by all authenticated users, writable by admins
-- ---------------------------------------------------------------------------

create policy contractors_select on public.contractors
  for select to authenticated using (true);
create policy contractors_admin_write on public.contractors
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy audit_types_select on public.audit_types
  for select to authenticated using (true);
create policy audit_types_admin_write on public.audit_types
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy audit_questions_select on public.audit_questions
  for select to authenticated using (true);
create policy audit_questions_admin_write on public.audit_questions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy nc_categories_select on public.nc_categories
  for select to authenticated using (true);
create policy nc_categories_admin_write on public.nc_categories
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Profiles: users see themselves; admins see and manage everyone.
-- Role changes are therefore admin-only (users cannot update their own row).
-- ---------------------------------------------------------------------------

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Audits
-- ---------------------------------------------------------------------------

-- Visible: finalized audits to everyone; drafts only to their auditor/admin.
create policy audits_select on public.audits
  for select to authenticated
  using (
    status in ('submitted', 'approved')
    or auditor_id = auth.uid()
    or public.is_admin()
  );

-- Auditors create drafts as themselves; admins can create anything.
create policy audits_insert on public.audits
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      public.current_user_role() = 'auditor'
      and auditor_id = auth.uid()
      and status = 'draft'
    )
  );

-- Auditors edit their own drafts and may move them draft -> submitted.
-- Only admins touch submitted/approved audits (approve, reopen, correct).
create policy audits_update on public.audits
  for update to authenticated
  using (
    public.is_admin()
    or (
      public.current_user_role() = 'auditor'
      and auditor_id = auth.uid()
      and status = 'draft'
    )
  )
  with check (
    public.is_admin()
    or (
      auditor_id = auth.uid()
      and status in ('draft', 'submitted')
    )
  );

-- Auditors may discard their own drafts; admins may delete any audit.
create policy audits_delete on public.audits
  for delete to authenticated
  using (
    public.is_admin()
    or (
      public.current_user_role() = 'auditor'
      and auditor_id = auth.uid()
      and status = 'draft'
    )
  );

-- ---------------------------------------------------------------------------
-- Audit responses: permissions follow the parent audit
-- ---------------------------------------------------------------------------

create or replace function public.can_edit_audit(p_audit_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.audits a
    where a.id = p_audit_id
      and (
        public.is_admin()
        or (
          public.current_user_role() = 'auditor'
          and a.auditor_id = auth.uid()
          and a.status = 'draft'
        )
      )
  );
$$;

create policy audit_responses_select on public.audit_responses
  for select to authenticated
  using (
    exists (
      select 1 from public.audits a
      where a.id = audit_id
        and (
          a.status in ('submitted', 'approved')
          or a.auditor_id = auth.uid()
          or public.is_admin()
        )
    )
  );

create policy audit_responses_insert on public.audit_responses
  for insert to authenticated
  with check (public.can_edit_audit(audit_id));

create policy audit_responses_update on public.audit_responses
  for update to authenticated
  using (public.can_edit_audit(audit_id))
  with check (public.can_edit_audit(audit_id));

create policy audit_responses_delete on public.audit_responses
  for delete to authenticated
  using (public.can_edit_audit(audit_id));

-- ============================================================
-- supabase/migrations/0004_corrective_actions.sql
-- ============================================================
-- 0004_corrective_actions.sql
-- Post-submission corrective-action workflow.
--
-- While an audit is draft, its auditor edits corrective-action status through
-- the normal response-edit path. Once the audit is submitted/approved the
-- responses are locked — but the corrective action still has a life of its
-- own (open -> in_progress -> closed -> verified). This function lets the
-- audit's own auditor and admins advance ONLY that column on finalized
-- audits, without reopening anything else for edit.

-- Guard the score-refresh trigger first: recompute only when something
-- scoring-relevant changed. Without this, advancing a corrective action on a
-- finalized audit would recompute the score with *current* question weights
-- and could silently rewrite a historical score after a weight change.
create or replace function public.refresh_audit_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if tg_op = 'UPDATE'
     and new.audit_id = old.audit_id
     and new.question_id = old.question_id
     and new.result = old.result then
    return new;
  end if;

  target := coalesce(new.audit_id, old.audit_id);
  update public.audits
     set score = public.calculate_audit_score(target)
   where id = target;

  if tg_op = 'UPDATE' and new.audit_id is distinct from old.audit_id then
    update public.audits
       set score = public.calculate_audit_score(old.audit_id)
     where id = old.audit_id;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.update_corrective_action(
  p_response_id uuid,
  p_status public.corrective_action_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result   public.audit_result;
  v_status   public.audit_status;
  v_auditor  uuid;
  v_role     public.user_role;
begin
  select r.result, a.status, a.auditor_id
    into v_result, v_status, v_auditor
  from public.audit_responses r
  join public.audits a on a.id = r.audit_id
  where r.id = p_response_id;

  if not found then
    raise exception 'response not found';
  end if;
  if v_result <> 'non_compliance' then
    raise exception 'corrective actions exist only on non-compliance responses';
  end if;
  if v_status not in ('submitted', 'approved') then
    raise exception 'use the normal edit path while the audit is a draft';
  end if;

  v_role := public.current_user_role();
  if not (v_role = 'admin' or (v_role = 'auditor' and v_auditor = auth.uid())) then
    raise exception 'only the audit''s auditor or an admin can update corrective actions';
  end if;

  update public.audit_responses
     set corrective_action_status = p_status
   where id = p_response_id;
end;
$$;

revoke execute on function public.update_corrective_action from public, anon;
grant execute on function public.update_corrective_action to authenticated;

-- ============================================================
-- supabase/seed.sql
-- ============================================================
-- seed.sql
-- Controlled vocabularies and the initial Welfare Management Audit question
-- set. Idempotent: safe to run repeatedly.

-- ---------------------------------------------------------------------------
-- NC classification taxonomy (controlled — auditors never type a reason)
-- ---------------------------------------------------------------------------

insert into public.nc_categories (code, name, description, sort_order) values
  ('NC-NAV', 'Documentation Not Available',
   'The required document or control does not exist.', 10),
  ('NC-NAP', 'Documentation Available but Not Approved',
   'The document exists but the required approval is absent.', 20),
  ('NC-INC', 'Incomplete Documentation / Missing Requirements',
   'The document exists but required elements are missing.', 30),
  ('NC-NIM', 'Not Implemented',
   'The document/control exists but is not implemented.', 40),
  ('NC-PIM', 'Partially Implemented',
   'Implementation has started but is incomplete.', 50),
  ('NC-OTH', 'Other (Controlled)',
   'Does not fit the standard classifications; review periodically — recurring uses should become their own classification.', 60)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Audit type: Welfare Management Audit
-- ---------------------------------------------------------------------------

insert into public.audit_types (code, name, description) values
  ('WMA', 'Welfare Management Audit',
   'Contractor welfare management system audit: plans, facilities, processes and implementation. Records contractor-level compliance results only.')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Question set (controls). Weights default to 1.00; adjust per control
-- criticality if a weighted scheme is adopted.
-- ---------------------------------------------------------------------------

with wma as (select id from public.audit_types where code = 'WMA')
insert into public.audit_questions (audit_type_id, code, category, question, sort_order)
select wma.id, q.code, q.category, q.question, q.sort_order
from wma,
(values
  ('WMP-01', 'Worker Management Plan',
   'Worker Management Plan is established and implemented in accordance with applicable requirements.', 10),
  ('WMP-02', 'Worker Management Plan',
   'Worker Management Plan is reviewed and updated at the required frequency and re-approved after changes.', 20),
  ('WMP-03', 'Worker Management Plan',
   'Roles and responsibilities for welfare management are defined, assigned and communicated.', 30),
  ('ACC-01', 'Accommodation',
   'Worker accommodation is provided and maintained in accordance with applicable standards.', 40),
  ('ACC-02', 'Accommodation',
   'Accommodation inspection program is established and inspections are performed at the required frequency.', 50),
  ('TRN-01', 'Transportation',
   'Worker transportation arrangements comply with applicable safety and welfare requirements.', 60),
  ('CAT-01', 'Catering & Water',
   'Catering and drinking water provisions comply with applicable health and welfare requirements.', 70),
  ('GRV-01', 'Grievance Mechanism',
   'A worker grievance mechanism is established, communicated and implemented in accordance with applicable requirements.', 80),
  ('GRV-02', 'Grievance Mechanism',
   'Grievances are tracked, resolved and closed within the required timeframes.', 90),
  ('WEL-01', 'Welfare Officer',
   'Qualified welfare personnel are appointed in accordance with applicable requirements.', 100),
  ('TRG-01', 'Training & Awareness',
   'Worker welfare induction and awareness training is delivered in accordance with applicable requirements.', 110),
  ('MON-01', 'Monitoring & Reporting',
   'Welfare monitoring, self-inspection and reporting are performed at the required frequency.', 120)
) as q(code, category, question, sort_order)
on conflict (audit_type_id, code) do nothing;

