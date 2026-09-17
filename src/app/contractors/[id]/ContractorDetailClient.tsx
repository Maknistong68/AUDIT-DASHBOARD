"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useEhss } from "@/lib/ehss/store";
import { contractorLabel } from "@/lib/ehss/mock";
import { StatTile } from "@/components/StatTile";
import { ScoreMeter } from "@/components/ScoreMeter";
import { RatingBadge, AuditStatusBadge } from "@/components/Badges";
import { TrendChart } from "@/components/charts/TrendChart";
import { formatDate, formatScore } from "@/lib/format";
import { OBSERVATION_BY_CODE, quarterLabel } from "@/lib/ehss/model";
import {
  TIMEFRAMES,
  collectObservations,
  contractorStats,
  summarizeAll,
  timeframeById,
  topIssues,
  type TimeframeId,
} from "@/lib/ehss/summaries";

export function ContractorDetailClient({ contractorId }: { contractorId: string }) {
  const { hydrated, subRegions, contractors, audits } = useEhss();
  const [timeframe, setTimeframe] = useState<TimeframeId>("all");

  const contractor = contractors.find((c) => c.id === contractorId);
  const subRegion = subRegions.find((s) => s.id === contractor?.subRegionId);

  const contractorAudits = useMemo(
    () => audits.filter((a) => a.contractorId === contractorId),
    [audits, contractorId],
  );

  const summaries = useMemo(
    () => summarizeAll(contractorAudits, contractors, subRegions),
    [contractorAudits, contractors, subRegions],
  );

  const stats = contractorStats(summaries, timeframe)[0] ?? null;

  const windowIds = useMemo(
    () => new Set(stats?.audits.map((a) => a.id) ?? []),
    [stats],
  );
  const issues = useMemo(
    () => topIssues(contractorAudits.filter((a) => windowIds.has(a.id)), 10),
    [contractorAudits, windowIds],
  );
  const observations = useMemo(
    () =>
      collectObservations(
        contractorAudits.filter((a) => windowIds.has(a.id)),
        contractors,
      ),
    [contractorAudits, windowIds, contractors],
  );

  if (!contractor || !subRegion) {
    return (
      <div className="card">
        <h2>{hydrated ? "Contractor not found" : "Loading…"}</h2>
      </div>
    );
  }

  const allReviews = [...summaries].sort((a, b) =>
    b.quarter.localeCompare(a.quarter),
  );

  return (
    <div className="stack">
      <div className="filter-row">
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Timeframe</span>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as TimeframeId)}
          >
            {TIMEFRAMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="kpi-row">
        <StatTile
          label={`${contractorLabel(contractor)} · ${timeframeById(timeframe).label.toLowerCase()}`}
          value={formatScore(stats?.avgScore ?? null)}
          hint={`${subRegion.name}${contractor.active ? "" : " · inactive"}`}
        />
        <StatTile label="Rating" value={stats?.rating ?? "—"} />
        <StatTile
          label="Direction"
          value={
            stats?.delta === null || stats?.delta === undefined
              ? "—"
              : `${stats.delta > 0 ? "+" : ""}${stats.delta.toFixed(1)} pts`
          }
          hint="across the window"
        />
        <StatTile
          label="Gap observations"
          value={String(observations.length)}
          hint="in the window"
        />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>{contractorLabel(contractor)} — quarterly trend</h2>
          <p className="sub">Total score per finalized review</p>
          <TrendChart
            points={(stats?.audits ?? [])
              .filter((s) => s.total !== null)
              .map((s) => ({ label: quarterLabel(s.quarter), value: s.total! }))}
          />
        </section>

        <section className="card">
          <h2>Discipline scores</h2>
          <p className="sub">Average across the window · weighted to the total</p>
          <table className="data">
            <tbody>
              {(stats?.disciplineAverages ?? []).map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.name}
                    <span style={{ color: "var(--muted)" }}>
                      {" "}
                      {Math.round(d.weight * 100)}%
                    </span>
                  </td>
                  <td style={{ width: 170 }}>
                    <ScoreMeter score={d.avg} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="card">
        <h2>Top issues</h2>
        <p className="sub">
          Questions costing the most score in the window, by weighted points
          lost
        </p>
        {issues.length === 0 ? (
          <div className="chart-empty">No Partial or No answers in scope.</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Question</th>
                <th>Area</th>
                <th className="num">Times</th>
                <th className="num">Points lost</th>
                <th>Main classification</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.questionCode}>
                  <td>
                    <strong>{i.questionCode}</strong>{" "}
                    <span className="q-weight">w{i.weight}</span>
                    <div className="issue-text">{i.questionText}</div>
                  </td>
                  <td>{i.subSectionTitle ?? `Section ${i.sectionCode}`}</td>
                  <td className="num">{i.occurrences}</td>
                  <td className="num">{i.lostPoints}</td>
                  <td>
                    {i.topObservation
                      ? `${i.topObservation} — ${OBSERVATION_BY_CODE[i.topObservation].label}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Review history</h2>
        <p className="sub">Every quarterly review on record</p>
        <table className="data">
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Date</th>
              <th>Ref</th>
              <th>Status</th>
              <th className="num">Score</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {allReviews.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/audits/${s.id}`}>{quarterLabel(s.quarter)}</Link>
                </td>
                <td>{formatDate(s.auditDate)}</td>
                <td>{s.inspectionNo}</td>
                <td>
                  <AuditStatusBadge status={s.status} />
                </td>
                <td className="num">
                  {s.status === "draft" ? "—" : formatScore(s.overall)}
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
    </div>
  );
}
