import Link from "next/link";
import {
  getAuditScores,
  getLatestScores,
  getNcBreakdown,
  getWeakestQuestions,
} from "@/lib/data";
import { StatTile } from "@/components/StatTile";
import { ScoreMeter } from "@/components/ScoreMeter";
import { TrendChart, type TrendChartPoint } from "@/components/charts/TrendChart";
import { ParetoBars } from "@/components/charts/ParetoBars";
import { ncCategoryBreakdown } from "@/lib/scoring";
import { formatScore } from "@/lib/format";
import type { AuditScoreRow } from "@/lib/db";

export const dynamic = "force-dynamic";

function monthlyAverages(rows: AuditScoreRow[]): TrendChartPoint[] {
  const byMonth = new Map<string, number[]>();
  for (const r of rows) {
    if (r.score === null) continue;
    const month = r.audit_date.slice(0, 7); // YYYY-MM
    const list = byMonth.get(month) ?? [];
    list.push(Number(r.score));
    byMonth.set(month, list);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, scores]) => ({
      label: new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      }),
      value: Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10,
    }));
}

export default async function OverviewPage() {
  const [scores, latest, ncRows, weakest] = await Promise.all([
    getAuditScores(),
    getLatestScores(),
    getNcBreakdown(),
    getWeakestQuestions(8),
  ]);

  const scored = latest.filter((l) => l.latest_score !== null);
  const programAvg =
    scored.length > 0
      ? scored.reduce((s, l) => s + Number(l.latest_score), 0) / scored.length
      : null;
  const openActions = ncRows.filter(
    (r) =>
      r.corrective_action_status === "open" ||
      r.corrective_action_status === "in_progress",
  ).length;

  const pareto = ncCategoryBreakdown(
    ncRows.map((r) => ({ ncCategoryName: r.nc_category_name })),
  ).map((p) => ({ label: p.name, count: p.count, share: p.share }));

  return (
    <div className="stack">
      <div className="kpi-row">
        <StatTile
          label="Program average score"
          value={formatScore(programAvg)}
          hint="mean of each contractor's latest audit"
        />
        <StatTile label="Finalized audits" value={String(scores.length)} />
        <StatTile
          label="Contractors audited"
          value={String(new Set(scores.map((s) => s.contractor_id)).size)}
        />
        <StatTile
          label="Open corrective actions"
          value={String(openActions)}
          hint="open or in progress"
        />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Average score by month</h2>
          <p className="sub">All contractors, finalized audits</p>
          <TrendChart points={monthlyAverages(scores)} />
        </section>

        <section className="card">
          <h2>Non-compliance causes</h2>
          <p className="sub">All NCs by classification</p>
          <ParetoBars data={pareto} />
        </section>
      </div>

      <section className="card">
        <h2>Weakest controls</h2>
        <p className="sub">Lowest compliance rate across finalized audits</p>
        {weakest.length === 0 ? (
          <div className="chart-empty">No finalized audits yet.</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Control</th>
                <th>Category</th>
                <th className="num">Applicable</th>
                <th className="num">NCs</th>
                <th>Compliance rate</th>
              </tr>
            </thead>
            <tbody>
              {weakest.map((q) => (
                <tr key={q.question_id}>
                  <td>
                    <strong>{q.question_code}</strong>
                  </td>
                  <td>{q.question_category}</td>
                  <td className="num">{q.times_applicable}</td>
                  <td className="num">{q.times_non_compliant}</td>
                  <td>
                    <ScoreMeter score={q.compliance_rate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Contractor standings</h2>
        <p className="sub">Latest finalized score per contractor and audit type</p>
        {latest.length === 0 ? (
          <div className="chart-empty">No finalized audits yet.</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Contractor</th>
                <th>Audit type</th>
                <th>Latest audit</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {[...latest]
                .sort(
                  (a, b) =>
                    Number(a.latest_score ?? -1) - Number(b.latest_score ?? -1),
                )
                .map((l) => (
                  <tr key={`${l.contractor_id}-${l.audit_type_id}`}>
                    <td>
                      <Link href={`/contractors/${l.contractor_id}`}>
                        {l.contractor_name}
                      </Link>
                    </td>
                    <td>{l.audit_type_name}</td>
                    <td>{l.latest_audit_date}</td>
                    <td>
                      <ScoreMeter score={l.latest_score} />
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
