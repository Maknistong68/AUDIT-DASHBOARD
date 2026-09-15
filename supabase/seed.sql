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
