import { notFound } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { SetupNotice } from "@/components/SetupNotice";
import { AuditStatusBadge } from "@/components/Badges";
import { formatDate } from "@/lib/format";
import { AuditEntryForm } from "./AuditEntryForm";
import type {
  AuditQuestionRow,
  AuditResponseRow,
  AuditRow,
  NcCategoryRow,
} from "@/lib/db";

export const dynamic = "force-dynamic";

interface AuditDetailRow extends AuditRow {
  contractors: { name: string; code: string } | null;
  audit_types: { name: string } | null;
}

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!hasSupabaseEnv()) return <SetupNotice />;
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const auditRes = await supabase
    .from("audits")
    .select("*, contractors(name, code), audit_types(name)")
    .eq("id", id)
    .maybeSingle();

  const audit = auditRes.data as unknown as AuditDetailRow | null;
  if (!audit) notFound();

  const [questionsRes, responsesRes, ncRes, profileRes] = await Promise.all([
    supabase
      .from("audit_questions")
      .select("*")
      .eq("audit_type_id", audit.audit_type_id)
      .eq("active", true)
      .order("sort_order"),
    supabase.from("audit_responses").select("*").eq("audit_id", id),
    supabase
      .from("nc_categories")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    user
      ? supabase.from("profiles").select("role").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
  ]);

  const role = (profileRes.data as { role: string } | null)?.role ?? "viewer";
  const isAdmin = role === "admin";
  const canEdit =
    audit.status === "draft" &&
    (isAdmin || (role === "auditor" && audit.auditor_id === user?.id));

  return (
    <div className="stack">
      <section className="card">
        <h2>
          {audit.contractors?.name ?? "Contractor"} —{" "}
          {audit.audit_types?.name ?? "Audit"}
        </h2>
        <p className="sub">
          {formatDate(audit.audit_date)} · <AuditStatusBadge status={audit.status} />
        </p>
        <AuditEntryForm
          auditId={audit.id}
          auditStatus={audit.status}
          canEdit={canEdit}
          isAdmin={isAdmin}
          questions={(questionsRes.data ?? []) as AuditQuestionRow[]}
          responses={(responsesRes.data ?? []) as AuditResponseRow[]}
          ncCategories={(ncRes.data ?? []) as NcCategoryRow[]}
        />
      </section>
    </div>
  );
}
