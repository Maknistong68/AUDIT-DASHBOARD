import { notFound } from "next/navigation";
import Link from "next/link";
import { audits, contractorById, contractors, subRegionById, subRegions } from "@/lib/ehss/mock";
import {
  collectObservations,
  finalized,
  summarizeAll,
} from "@/lib/ehss/summaries";
import { OBSERVATION_BY_CODE, quarterLabel } from "@/lib/ehss/model";
import { StatTile } from "@/components/StatTile";
import { ScoreMeter } from "@/components/ScoreMeter";
import { RatingBadge } from "@/components/Badges";
import { TrendChart } from "@/components/charts/TrendChart";
import { formatScore } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContractorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contractor = contractorById.get(id);
  if (!contractor) notFound();
  const subRegion = subRegionById.get(contractor.subRegionId)!;

  const summaries = finalized(
    summarizeAll(audits, contractors, subRegions),
  )
    .filter((s) => s.contractorId === id)
    .sort((a, b) => a.quarter.localeCompare(b.quarter));
  const observations = collectObservations(audits, contractors).filter(
    (o) => o.contractorId === id,
  );

  const latest = summaries[summaries.length - 1];
  const first = summaries[0];
  const delta =
    latest && first && latest !== first && latest.total !== null && first.total !== null
      ? Math.round((latest.total - first.total) * 10) / 10
      : null;

  return (
    <div className="stack">
      <div className="kpi-row">
        <StatTile
          label={`${contractor.code} · latest score`}
          value={formatScore(latest?.total ?? null)}
          hint={
            latest
              ? `${quarterLabel(latest.quarter)} · ${subRegion.name}`
              : subRegion.name
          }
        />
        <StatTile
          label="Rating"
          value={latest?.rating ?? "—"}
        />
        <StatTile
          label="Trend since first audit"
          value={delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta} pts`}
        />
        <StatTile
          label="Gap observations"
          value={String(observations.length)}
          hint="across finalized audits"
        />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>{contractor.name} — quarterly trend</h2>
          <p className="sub">Total score per finalized review</p>
          <TrendChart
            points={summaries
              .filter((s) => s.total !== null)
              .map((s) => ({
                label: quarterLabel(s.quarter),
                value: s.total!,
              }))}
          />
        </section>

        <section className="card">
          <h2>Latest section scores</h2>
          <p className="sub">
            {latest ? quarterLabel(latest.quarter) : "No finalized audits"}
          </p>
          {latest ? (
            <table className="data">
              <tbody>
                {latest.sections.map((s) => (
                  <tr key={s.code}>
                    <td>
                      <strong>{s.code}</strong>
                    </td>
                    <td>{s.title}</td>
                    <td>
                      <ScoreMeter score={s.score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="chart-empty">No finalized audits yet.</div>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Sub-section detail</h2>
        <p className="sub">
          {latest ? `Latest review, ${quarterLabel(latest.quarter)}` : ""}
        </p>
        {latest ? (
          <table className="data">
            <tbody>
              {latest.subSections.map((ss) => (
                <tr key={ss.code}>
                  <td>
                    <strong>{ss.code}</strong>
                  </td>
                  <td>{ss.title}</td>
                  <td>
                    <ScoreMeter score={ss.score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="chart-empty">No finalized audits yet.</div>
        )}
      </section>

      <section className="card">
        <h2>Observations</h2>
        <p className="sub">Standardized gap classifications, newest first</p>
        {observations.length === 0 ? (
          <div className="chart-empty">No gap observations.</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Quarter</th>
                <th>Question</th>
                <th>Area</th>
                <th>Answer</th>
                <th>Classification</th>
              </tr>
            </thead>
            <tbody>
              {[...observations]
                .sort((a, b) => b.quarter.localeCompare(a.quarter))
                .map((o) => (
                  <tr key={`${o.auditId}-${o.questionCode}`}>
                    <td>
                      <Link href={`/audits/${o.auditId}`}>
                        {quarterLabel(o.quarter)}
                      </Link>
                    </td>
                    <td>
                      <strong>{o.questionCode}</strong>
                    </td>
                    <td>{o.subSectionTitle ?? `Section ${o.sectionCode}`}</td>
                    <td>{o.answer === "no" ? "No" : "Partial"}</td>
                    <td>
                      {o.observation} —{" "}
                      {OBSERVATION_BY_CODE[o.observation].label}
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
