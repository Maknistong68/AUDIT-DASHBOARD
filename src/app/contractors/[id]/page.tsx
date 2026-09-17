import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getContractor,
  getContractorScores,
  getNcBreakdown,
} from "@/lib/data";
import { StatTile } from "@/components/StatTile";
import { TrendChart } from "@/components/charts/TrendChart";
import { ParetoBars } from "@/components/charts/ParetoBars";
import { CorrectiveActionBadge } from "@/components/Badges";
import { ncCategoryBreakdown, trendDelta } from "@/lib/scoring";
import { formatDate, formatScore } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContractorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [contractor, scores, ncRows] = await Promise.all([
    getContractor(id),
    getContractorScores(id),
    getNcBreakdown(id),
  ]);
  if (!contractor) notFound();

  const scored = scores.filter((s) => s.score !== null);
  const latest = scored[scored.length - 1];
  const delta = trendDelta(
    scored.map((s) => ({ auditDate: s.audit_date, score: Number(s.score) })),
  );

  const pareto = ncCategoryBreakdown(
    ncRows.map((r) => ({ ncCategoryName: r.nc_category_name })),
  ).map((p) => ({ label: p.name, count: p.count, share: p.share }));
  const openActions = ncRows.filter(
    (r) =>
      r.corrective_action_status === "open" ||
      r.corrective_action_status === "in_progress",
  );

  return (
    <div className="stack">
      <div className="kpi-row">
        <StatTile
          label={`${contractor.code} · latest score`}
          value={formatScore(latest ? Number(latest.score) : null)}
          hint={
            latest
              ? `${latest.audit_type_name}, ${formatDate(latest.audit_date)}`
              : "no finalized audits"
          }
        />
        <StatTile
          label="Trend since first audit"
          value={delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta} pts`}
        />
        <StatTile label="Finalized audits" value={String(scores.length)} />
        <StatTile
          label="Open corrective actions"
          value={String(openActions.length)}
        />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>{contractor.name} — score trend</h2>
          <p className="sub">Finalized audits, oldest to newest</p>
          <TrendChart
            points={scored.map((s) => ({
              label: formatDate(s.audit_date),
              value: Number(s.score),
            }))}
          />
        </section>

        <section className="card">
          <h2>Main weaknesses</h2>
          <p className="sub">This contractor&apos;s NCs by classification</p>
          <ParetoBars data={pareto} />
        </section>
      </div>

      <section className="card">
        <h2>Non-compliance detail</h2>
        <p className="sub">Every NC across finalized audits</p>
        {ncRows.length === 0 ? (
          <div className="chart-empty">No non-compliances recorded.</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Audit date</th>
                <th>Control</th>
                <th>Category</th>
                <th>Classification</th>
                <th>Corrective action</th>
              </tr>
            </thead>
            <tbody>
              {[...ncRows]
                .sort((a, b) => b.audit_date.localeCompare(a.audit_date))
                .map((r) => (
                  <tr key={`${r.audit_id}-${r.question_id}`}>
                    <td>
                      <Link href={`/audits/${r.audit_id}`}>
                        {formatDate(r.audit_date)}
                      </Link>
                    </td>
                    <td>
                      <strong>{r.question_code}</strong>
                    </td>
                    <td>{r.question_category}</td>
                    <td>{r.nc_category_name}</td>
                    <td>
                      {r.corrective_action_status ? (
                        <CorrectiveActionBadge
                          status={r.corrective_action_status}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
