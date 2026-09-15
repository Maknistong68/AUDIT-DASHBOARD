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
