-- mock_data.sql — demo dataset for evaluating the app.
--
-- Run AFTER setup.sql and AFTER creating your own user account (sign in once,
-- or Dashboard -> Authentication -> Add user). The script:
--   * promotes the earliest-created user to admin (that's you),
--   * creates Contractor One / Two / Three,
--   * creates six Welfare Management Audits across 2026 with realistic
--     results: an improving contractor, a declining one, and a new one —
--     scores 58.33 -> 75.00 -> 90.91 (C1), 83.33 -> 72.73 (C2), 66.67 (C3),
--   * spreads NCs across the classification taxonomy with corrective
--     actions in every state, plus a couple of observations.
--
-- Idempotent: re-running skips audits that already exist.
-- Demo data only — delete these contractors before entering real audits.

do $$
declare
  v_auditor uuid;
  v_wma     uuid;
  v_def     jsonb;
  v_defs    jsonb := '[
    {"id":"20000000-0000-0000-0000-000000000001","c":"C1","date":"2026-03-15","status":"approved",
     "nc":{"WMP-02":"closed","ACC-01":"closed","ACC-02":"verified","GRV-02":"closed","TRG-01":"verified"},
     "na":[],"obs":{}},
    {"id":"20000000-0000-0000-0000-000000000002","c":"C1","date":"2026-06-10","status":"approved",
     "nc":{"ACC-02":"closed","GRV-02":"in_progress","TRG-01":"closed"},
     "na":[],"obs":{}},
    {"id":"20000000-0000-0000-0000-000000000003","c":"C1","date":"2026-09-05","status":"submitted",
     "nc":{"GRV-02":"open"},
     "na":["TRN-01"],"obs":{"WMP-01":"positive_practice"}},
    {"id":"20000000-0000-0000-0000-000000000004","c":"C2","date":"2026-04-20","status":"approved",
     "nc":{"CAT-01":"verified","MON-01":"closed"},
     "na":[],"obs":{}},
    {"id":"20000000-0000-0000-0000-000000000005","c":"C2","date":"2026-07-15","status":"submitted",
     "nc":{"CAT-01":"open","MON-01":"in_progress","ACC-01":"open"},
     "na":["TRN-01"],"obs":{"WEL-01":"improvement_opportunity"}},
    {"id":"20000000-0000-0000-0000-000000000006","c":"C3","date":"2026-08-28","status":"approved",
     "nc":{"WMP-01":"open","WMP-02":"open","WEL-01":"in_progress","TRG-01":"open"},
     "na":[],"obs":{}}
  ]'::jsonb;
  q         record;
  v_result  public.audit_result;
  v_nc_code text;
  v_nc_id   uuid;
  v_ca      public.corrective_action_status;
  v_obs     public.observation_type;
begin
  select id into v_auditor from public.profiles order by created_at limit 1;
  if v_auditor is null then
    raise exception 'No users yet. Create your account first (sign in once, or Authentication -> Add user), then re-run this script.';
  end if;
  update public.profiles set role = 'admin' where id = v_auditor;

  select id into v_wma from public.audit_types where code = 'WMA';
  if v_wma is null then
    raise exception 'Audit type WMA not found — run setup.sql (or the migrations + seed) first.';
  end if;

  insert into public.contractors (code, name) values
    ('C1', 'Contractor One'),
    ('C2', 'Contractor Two'),
    ('C3', 'Contractor Three')
  on conflict (code) do nothing;

  for v_def in select * from jsonb_array_elements(v_defs) loop
    if exists (select 1 from public.audits where id = (v_def->>'id')::uuid) then
      continue;
    end if;

    insert into public.audits (id, contractor_id, audit_type_id, audit_date, status, auditor_id)
    select (v_def->>'id')::uuid, c.id, v_wma, (v_def->>'date')::date,
           (v_def->>'status')::public.audit_status, v_auditor
    from public.contractors c
    where c.code = v_def->>'c';

    for q in
      select id, code from public.audit_questions
      where audit_type_id = v_wma and active
      order by sort_order
    loop
      if v_def->'nc' ? q.code then
        v_result := 'non_compliance';
        v_ca := (v_def->'nc'->>q.code)::public.corrective_action_status;
        -- Classification by control: which taxonomy entry this NC demonstrates.
        v_nc_code := case q.code
          when 'WMP-01' then 'NC-NAV'
          when 'WMP-02' then 'NC-NAP'
          when 'ACC-01' then 'NC-PIM'
          when 'ACC-02' then 'NC-NIM'
          when 'CAT-01' then 'NC-PIM'
          when 'MON-01' then 'NC-NAV'
          when 'WEL-01' then 'NC-NAP'
          else 'NC-INC'
        end;
        select id into v_nc_id from public.nc_categories where code = v_nc_code;
      elsif v_def->'na' ? q.code then
        v_result := 'not_applicable';
        v_ca := null;
        v_nc_id := null;
      else
        v_result := 'full_compliance';
        v_ca := null;
        v_nc_id := null;
      end if;

      v_obs := (v_def->'obs'->>q.code)::public.observation_type;

      insert into public.audit_responses
        (audit_id, question_id, result, nc_category_id, observation, corrective_action_status)
      values
        ((v_def->>'id')::uuid, q.id, v_result, v_nc_id, v_obs, v_ca);
    end loop;
  end loop;

  raise notice 'Mock data loaded. The earliest-created user is now admin.';
end
$$;
