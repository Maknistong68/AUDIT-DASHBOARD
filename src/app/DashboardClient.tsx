"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatTile } from "@/components/StatTile";
import { ScoreMeter } from "@/components/ScoreMeter";
import { RatingBadge } from "@/components/Badges";
import { TrendChart } from "@/components/charts/TrendChart";
import { ParetoBars } from "@/components/charts/ParetoBars";
import { formatScore } from "@/lib/format";
import {
  OBSERVATION_BY_CODE,
  quarterLabel,
  ratingFor,
  type EhssContractor,
  type SubRegion,
} from "@/lib/ehss/model";
import {
  averageByQuarter,
  finalized,
  latestByContractor,
  weakestSubSections,
  type AuditSummary,
  type ObservationRow,
} from "@/lib/ehss/summaries";

export function DashboardClient({
  subRegions,
  contractors,
  summaries,
  observations,
}: {
  subRegions: SubRegion[];
  contractors: EhssContractor[];
  summaries: AuditSummary[];
  observations: ObservationRow[];
}) {
  const [subRegionId, setSubRegionId] = useState<string>("all");
  const [contractorId, setContractorId] = useState<string>("all");

  const contractorOptions =
    subRegionId === "all"
      ? contractors
      : contractors.filter((c) => c.subRegionId === subRegionId);

  const filtered = useMemo(
    () =>
      summaries.filter(
        (s) =>
          (subRegionId === "all" || s.subRegionId === subRegionId) &&
          (contractorId === "all" || s.contractorId === contractorId),
      ),
    [summaries, subRegionId, contractorId],
  );
  const filteredObs = useMemo(
    () =>
      observations.filter(
        (o) =>
          (subRegionId === "all" || o.subRegionId === subRegionId) &&
          (contractorId === "all" || o.contractorId === contractorId),
      ),
    [observations, subRegionId, contractorId],
  );

  const latest = latestByContractor(filtered);
  const scored = latest.filter((s) => s.total !== null);
  const avg =
    scored.length > 0
      ? Math.round(
          (scored.reduce((sum, s) => sum + s.total!, 0) / scored.length) * 10,
        ) / 10
      : null;

  const trend = averageByQuarter(filtered).map((p) => ({
    label: quarterLabel(p.quarter),
    value: p.score,
  }));

  const sectionAverages = ["A", "B", "C"].map((code) => {
    const scores = latest
      .map((s) => s.sections.find((x) => x.code === code))
      .filter((x) => x && x.score !== null) as { title: string; score: number }[];
    return {
      code,
      title: scores[0]?.title ?? code,
      avg:
        scores.length > 0
          ? Math.round(
              (scores.reduce((sum, x) => sum + x.score, 0) / scores.length) * 10,
            ) / 10
          : null,
    };
  });

  const pareto = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of filteredObs) {
      counts.set(o.observation, (counts.get(o.observation) ?? 0) + 1);
    }
    const total = filteredObs.length;
    return [...counts.entries()]
      .map(([code, count]) => ({
        label: `${code} — ${OBSERVATION_BY_CODE[code as keyof typeof OBSERVATION_BY_CODE].label}`,
        count,
        share: total ? Math.round((count / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredObs]);

  const weakest = weakestSubSections(filtered, 8);

  return (
    <div className="stack">
      {/* Filters scope everything below them */}
      <div className="filter-row">
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Sub-region</span>
          <select
            value={subRegionId}
            onChange={(e) => {
              setSubRegionId(e.target.value);
              setContractorId("all");
            }}
          >
            <option value="all">All sub-regions</option>
            {subRegions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Contractor</span>
          <select
            value={contractorId}
            onChange={(e) => setContractorId(e.target.value)}
          >
            <option value="all">All contractors</option>
            {contractorOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="kpi-row">
        <StatTile
          label="Average score"
          value={formatScore(avg)}
          hint="latest audit per contractor"
        />
        <StatTile
          label="Rating"
          value={ratingFor(avg) ?? "—"}
        />
        <StatTile
          label="Audits completed"
          value={String(finalized(filtered).length)}
        />
        <StatTile
          label="Gap observations"
          value={String(filteredObs.length)}
          hint="Partial or No answers"
        />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Score trend by quarter</h2>
          <p className="sub">Average of finalized audits in scope</p>
          <TrendChart points={trend} />
        </section>

        <section className="card">
          <h2>Observation causes</h2>
          <p className="sub">Standardized gap classifications (OB2–OB5)</p>
          <ParetoBars data={pareto} />
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Section performance</h2>
          <p className="sub">Average of each contractor&apos;s latest audit</p>
          <table className="data">
            <tbody>
              {sectionAverages.map((s) => (
                <tr key={s.code}>
                  <td>
                    <strong>{s.code}</strong>
                  </td>
                  <td>{s.title}</td>
                  <td>
                    <ScoreMeter score={s.avg} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>Weakest sub-sections</h2>
          <p className="sub">Lowest average score in scope</p>
          {weakest.length === 0 ? (
            <div className="chart-empty">No finalized audits in scope.</div>
          ) : (
            <table className="data">
              <tbody>
                {weakest.map((w) => (
                  <tr key={w.code}>
                    <td>
                      <strong>{w.code}</strong>
                    </td>
                    <td>{w.title}</td>
                    <td>
                      <ScoreMeter score={w.avg} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Contractor standings</h2>
        <p className="sub">Latest finalized audit per contractor in scope</p>
        {latest.length === 0 ? (
          <div className="chart-empty">No finalized audits in scope.</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Contractor</th>
                <th>Sub-region</th>
                <th>Quarter</th>
                <th>Score</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {[...latest]
                .sort((a, b) => (a.total ?? -1) - (b.total ?? -1))
                .map((s) => (
                  <tr key={s.contractorId}>
                    <td>
                      <Link href={`/contractors/${s.contractorId}`}>
                        {s.contractorName}
                      </Link>
                    </td>
                    <td>{s.subRegionName}</td>
                    <td>{quarterLabel(s.quarter)}</td>
                    <td>
                      <ScoreMeter score={s.total} />
                    </td>
                    <td>
                      <RatingBadge rating={s.rating} />
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
