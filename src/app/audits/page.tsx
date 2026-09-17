import Link from "next/link";
import { getAuditsList, getCurrentUser } from "@/lib/data";
import { isDemoMode } from "@/lib/demo/mode";
import { AuditStatusBadge } from "@/components/Badges";
import { formatDate, formatScore } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AuditsPage() {
  const [audits, user] = await Promise.all([getAuditsList(), getCurrentUser()]);
  const demo = isDemoMode();
  const canCreate =
    !demo && (user?.role === "auditor" || user?.role === "admin");

  return (
    <section className="card">
      <h2>Audits</h2>
      <p className="sub">
        {demo
          ? "Demo data — open the draft to try the scoring form."
          : "Drafts are visible only to their auditor and admins."}
      </p>
      {canCreate && (
        <p>
          <Link href="/audits/new">
            <button className="primary" type="button">
              New audit
            </button>
          </Link>
        </p>
      )}
      {audits.length === 0 ? (
        <div className="chart-empty">No audits yet.</div>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Contractor</th>
              <th>Audit type</th>
              <th>Status</th>
              <th className="num">Score</th>
            </tr>
          </thead>
          <tbody>
            {audits.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/audits/${a.id}`}>{formatDate(a.audit_date)}</Link>
                </td>
                <td>{a.contractor_name ?? "—"}</td>
                <td>{a.audit_type_name ?? "—"}</td>
                <td>
                  <AuditStatusBadge status={a.status} />
                </td>
                <td className="num">{formatScore(a.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
