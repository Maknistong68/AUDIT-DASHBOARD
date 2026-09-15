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
