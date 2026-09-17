import { notFound } from "next/navigation";
import { getAuditDetail, getCurrentUser } from "@/lib/data";
import { isDemoMode } from "@/lib/demo/mode";
import { AuditStatusBadge } from "@/components/Badges";
import { formatDate } from "@/lib/format";
import { AuditEntryForm } from "./AuditEntryForm";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [audit, user] = await Promise.all([
    getAuditDetail(id),
    getCurrentUser(),
  ]);
  if (!audit) notFound();

  const demo = isDemoMode();
  const isAdmin = user?.role === "admin";
  const canEdit =
    audit.status === "draft" &&
    (isAdmin ||
      (user?.role === "auditor" && (demo || audit.auditor_id === user?.id)));

  return (
    <div className="stack">
      <section className="card">
        <h2>
          {audit.contractor_name || "Contractor"} —{" "}
          {audit.audit_type_name || "Audit"}
        </h2>
        <p className="sub">
          {formatDate(audit.audit_date)} ·{" "}
          <AuditStatusBadge status={audit.status} />
        </p>
        <AuditEntryForm
          auditId={audit.id}
          auditStatus={audit.status}
          canEdit={canEdit}
          isAdmin={Boolean(isAdmin)}
          demoMode={demo}
          questions={audit.questions}
          responses={audit.responses}
          ncCategories={audit.ncCategories}
        />
      </section>
    </div>
  );
}
