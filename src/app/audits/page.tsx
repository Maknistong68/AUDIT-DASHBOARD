import Link from "next/link";
import { audits, contractors, subRegions } from "@/lib/ehss/mock";
import { summarizeAll } from "@/lib/ehss/summaries";
import { quarterLabel } from "@/lib/ehss/model";
import { AuditStatusBadge, RatingBadge } from "@/components/Badges";
import { formatDate, formatScore } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function AuditsPage() {
  const summaries = summarizeAll(audits, contractors, subRegions).sort(
    (a, b) =>
      b.quarter.localeCompare(a.quarter) ||
      a.contractorName.localeCompare(b.contractorName),
  );

  return (
    <section className="card">
      <h2>Quarterly audits</h2>
      <p className="sub">
        One EHSS performance review per contractor per quarter. Open the draft
        to try the entry form.
      </p>
      <table className="data">
        <thead>
          <tr>
            <th>Quarter</th>
            <th>Contractor</th>
            <th>Sub-region</th>
            <th>Date</th>
            <th>Ref</th>
            <th>Status</th>
            <th className="num">Score</th>
            <th>Rating</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s) => (
            <tr key={s.id}>
              <td>
                <Link href={`/audits/${s.id}`}>{quarterLabel(s.quarter)}</Link>
              </td>
              <td>{s.contractorName}</td>
              <td>{s.subRegionName}</td>
              <td>{formatDate(s.auditDate)}</td>
              <td>{s.inspectionNo}</td>
              <td>
                <AuditStatusBadge status={s.status} />
              </td>
              <td className="num">
                {s.status === "draft" ? "—" : formatScore(s.total)}
              </td>
              <td>
                {s.status === "draft" ? (
                  <span style={{ color: "var(--muted)" }}>in progress</span>
                ) : (
                  <RatingBadge rating={s.rating} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
