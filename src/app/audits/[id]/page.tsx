import { notFound } from "next/navigation";
import { auditById, contractorById, subRegionById } from "@/lib/ehss/mock";
import { quarterLabel } from "@/lib/ehss/model";
import { readDemoProfile } from "@/lib/demo/profile";
import { AuditStatusBadge } from "@/components/Badges";
import { formatDate } from "@/lib/format";
import { EhssAuditForm } from "./EhssAuditForm";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const audit = auditById.get(id);
  if (!audit) notFound();

  const contractor = contractorById.get(audit.contractorId)!;
  const subRegion = subRegionById.get(contractor.subRegionId)!;
  const profile = await readDemoProfile();
  const canEdit =
    audit.status === "draft" &&
    (profile?.role === "auditor" || profile?.role === "admin");

  return (
    <div className="stack">
      <section className="card">
        <h2>
          {contractor.name} — EHSS Quarterly Performance Review
        </h2>
        <p className="sub">
          {subRegion.name} · {quarterLabel(audit.quarter)} ·{" "}
          {formatDate(audit.auditDate)} · {audit.inspectionNo} ·{" "}
          <AuditStatusBadge status={audit.status} />
        </p>
        <EhssAuditForm
          initialResponses={audit.responses}
          canEdit={canEdit}
          status={audit.status}
        />
      </section>
    </div>
  );
}
