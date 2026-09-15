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
