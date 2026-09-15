-- smoke_test.sql
-- End-to-end database assertions: run after harness.sql + migrations + seed.
-- Covers the scoring trigger, structural constraints, and RLS for each role.
-- Any failed assertion aborts the script (ON_ERROR_STOP is set by the runner).

-- ---------------------------------------------------------------------------
-- Fixtures: users (via auth trigger) and roles
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'admin@example.test',    '{"full_name":"Test Admin"}'),
  ('00000000-0000-0000-0000-000000000002', 'auditor1@example.test', '{"full_name":"Test Auditor One"}'),
  ('00000000-0000-0000-0000-000000000003', 'auditor2@example.test', '{"full_name":"Test Auditor Two"}'),
  ('00000000-0000-0000-0000-000000000004', 'viewer@example.test',   '{"full_name":"Test Viewer"}');

do $$
begin
  assert (select count(*) from public.profiles) = 4,
    'auth trigger should auto-create one profile per user';
  assert (select bool_and(role = 'viewer') from public.profiles),
    'new profiles should default to viewer';
end
$$;

update public.profiles set role = 'admin'   where id = '00000000-0000-0000-0000-000000000001';
update public.profiles set role = 'auditor' where id in
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003');

-- ---------------------------------------------------------------------------
-- Admin manages reference data; viewer cannot
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
set role authenticated;

insert into public.contractors (code, name) values
  ('ABC', 'ABC Contracting'),
  ('XYZ', 'XYZ Industrial');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
set role authenticated;

do $$
begin
  begin
    insert into public.contractors (code, name) values ('BAD', 'Should Fail Co');
    raise exception 'viewer must not be able to insert contractors';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.audits (contractor_id, audit_type_id, audit_date, auditor_id)
    select c.id, t.id, '2026-09-01', '00000000-0000-0000-0000-000000000004'
    from public.contractors c, public.audit_types t
    where c.code = 'ABC' and t.code = 'WMA';
    raise exception 'viewer must not be able to create audits';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;

-- ---------------------------------------------------------------------------
-- Auditor 1 creates a draft audit and scores it
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
set role authenticated;

insert into public.audits (id, contractor_id, audit_type_id, audit_date, auditor_id)
select '10000000-0000-0000-0000-000000000001', c.id, t.id, '2026-09-01',
       '00000000-0000-0000-0000-000000000002'
from public.contractors c, public.audit_types t
where c.code = 'ABC' and t.code = 'WMA';

-- 3 FC, 1 NC, 1 NA -> 3 of 4 applicable -> 75.00
insert into public.audit_responses (audit_id, question_id, result, nc_category_id)
select '10000000-0000-0000-0000-000000000001', q.id, v.result::public.audit_result,
       case when v.result = 'non_compliance'
            then (select id from public.nc_categories where code = 'NC-NAP') end
from (values
  ('WMP-01', 'full_compliance'),
  ('WMP-02', 'non_compliance'),
  ('WMP-03', 'full_compliance'),
  ('ACC-01', 'full_compliance'),
  ('ACC-02', 'not_applicable')
) as v(code, result)
join public.audit_questions q on q.code = v.code;

do $$
begin
  assert (select score from public.audits
          where id = '10000000-0000-0000-0000-000000000001') = 75.00,
    'score should be 75.00 (3 FC of 4 applicable)';
end
$$;

-- Flipping the NC to FC should move the score to 100.
update public.audit_responses r
   set result = 'full_compliance', nc_category_id = null
from public.audit_questions q
where q.id = r.question_id and q.code = 'WMP-02'
  and r.audit_id = '10000000-0000-0000-0000-000000000001';

do $$
begin
  assert (select score from public.audits
          where id = '10000000-0000-0000-0000-000000000001') = 100.00,
    'score should be 100.00 after fixing the NC';
end
$$;

-- ...and back, for the rest of the test.
update public.audit_responses r
   set result = 'non_compliance',
       nc_category_id = (select id from public.nc_categories where code = 'NC-NAP'),
       corrective_action_status = 'open'
from public.audit_questions q
where q.id = r.question_id and q.code = 'WMP-02'
  and r.audit_id = '10000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Structural constraints
-- ---------------------------------------------------------------------------

do $$
declare
  q_grv uuid := (select id from public.audit_questions where code = 'GRV-01');
  q_trn uuid := (select id from public.audit_questions where code = 'TRN-01');
  nc    uuid := (select id from public.nc_categories where code = 'NC-NAV');
begin
  -- NC without a classification must fail.
  begin
    insert into public.audit_responses (audit_id, question_id, result)
    values ('10000000-0000-0000-0000-000000000001', q_grv, 'non_compliance');
    raise exception 'NC without nc_category must be rejected';
  exception when check_violation then null;
  end;

  -- FC with an NC classification must fail.
  begin
    insert into public.audit_responses (audit_id, question_id, result, nc_category_id)
    values ('10000000-0000-0000-0000-000000000001', q_grv, 'full_compliance', nc);
    raise exception 'FC with nc_category must be rejected';
  exception when check_violation then null;
  end;

  -- Corrective action on a compliant response must fail.
  begin
    insert into public.audit_responses
      (audit_id, question_id, result, corrective_action_status)
    values ('10000000-0000-0000-0000-000000000001', q_trn, 'full_compliance', 'open');
    raise exception 'corrective action on FC must be rejected';
  exception when check_violation then null;
  end;

  -- Duplicate response for the same question must fail.
  begin
    insert into public.audit_responses (audit_id, question_id, result)
    select '10000000-0000-0000-0000-000000000001', q.id, 'full_compliance'
    from public.audit_questions q where q.code = 'WMP-01';
    raise exception 'duplicate (audit_id, question_id) must be rejected';
  exception when unique_violation then null;
  end;
end
$$;

reset role;

-- Question from a different audit type must be rejected (cross-table trigger).
insert into public.audit_types (code, name) values ('OTH', 'Other Audit Type');
insert into public.audit_questions (audit_type_id, code, category, question)
select id, 'OTH-01', 'Other', 'Question from another audit type.'
from public.audit_types where code = 'OTH';

do $$
declare
  q_oth uuid := (select id from public.audit_questions where code = 'OTH-01');
begin
  begin
    insert into public.audit_responses (audit_id, question_id, result)
    values ('10000000-0000-0000-0000-000000000001', q_oth, 'full_compliance');
    raise exception 'question of a different audit type must be rejected';
  exception when raise_exception then null;
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- RLS: draft visibility and edit boundaries
-- ---------------------------------------------------------------------------

-- Auditor 2 must not see (or edit) auditor 1's draft.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
set role authenticated;

do $$
begin
  assert (select count(*) from public.audits
          where id = '10000000-0000-0000-0000-000000000001') = 0,
    'another auditor must not see a foreign draft';
  assert (select count(*) from public.audit_responses
          where audit_id = '10000000-0000-0000-0000-000000000001') = 0,
    'another auditor must not see responses of a foreign draft';
end
$$;

reset role;

-- Viewer must not see the draft either — and no draft leaks via the views.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
set role authenticated;

do $$
begin
  assert (select count(*) from public.audits) = 0,
    'viewer must not see draft audits';
  assert (select count(*) from public.v_audit_scores) = 0,
    'draft audits must not appear in v_audit_scores';
end
$$;

reset role;

-- Auditor 1 submits the audit.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
set role authenticated;

update public.audits set status = 'submitted'
where id = '10000000-0000-0000-0000-000000000001';

-- Once submitted, the auditor can no longer edit it (RLS row filter).
update public.audits set audit_date = '2026-09-02'
where id = '10000000-0000-0000-0000-000000000001';

do $$
begin
  assert (select audit_date from public.audits
          where id = '10000000-0000-0000-0000-000000000001') = date '2026-09-01',
    'auditor must not be able to edit a submitted audit';
end
$$;

reset role;

-- Viewer now sees the finalized audit through the analytics views.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
set role authenticated;

do $$
begin
  assert (select count(*) from public.v_audit_scores) = 1,
    'viewer must see the submitted audit in v_audit_scores';
  assert (select score from public.v_audit_scores limit 1) = 75.00,
    'submitted audit score must be 75.00';
  assert (select count(*) from public.v_nc_breakdown
          where nc_category_code = 'NC-NAP') = 1,
    'NC breakdown must show the WMP-02 non-compliance';
  assert (select count(*) from public.v_open_corrective_actions) = 1,
    'the open corrective action must be visible';
  assert (select times_applicable from public.v_question_performance
          where question_code = 'WMP-01') = 1,
    'question performance must count applicable responses';
end
$$;

reset role;

-- Admin approves.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
set role authenticated;

update public.audits set status = 'approved'
where id = '10000000-0000-0000-0000-000000000001';

do $$
begin
  assert (select status from public.audits
          where id = '10000000-0000-0000-0000-000000000001') = 'approved',
    'admin must be able to approve a submitted audit';
end
$$;

reset role;

-- ---------------------------------------------------------------------------
-- calculate_audit_score edge case: all responses NA -> NULL score
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
set role authenticated;

insert into public.audits (id, contractor_id, audit_type_id, audit_date, auditor_id)
select '10000000-0000-0000-0000-000000000002', c.id, t.id, '2026-09-10',
       '00000000-0000-0000-0000-000000000002'
from public.contractors c, public.audit_types t
where c.code = 'XYZ' and t.code = 'WMA';

insert into public.audit_responses (audit_id, question_id, result)
select '10000000-0000-0000-0000-000000000002', q.id, 'not_applicable'
from public.audit_questions q where q.code in ('WMP-01', 'WMP-02');

do $$
begin
  assert (select score from public.audits
          where id = '10000000-0000-0000-0000-000000000002') is null,
    'an all-NA audit must have NULL score, not 0';
end
$$;

reset role;

select 'smoke tests passed' as result;
