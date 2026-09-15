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
