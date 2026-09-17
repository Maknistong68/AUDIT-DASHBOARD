"use client";

import Link from "next/link";
import { TrendChart } from "@/components/charts/TrendChart";
import { ScoreMeter } from "@/components/ScoreMeter";
import { RatingBadge } from "@/components/Badges";
import { formatScore } from "@/lib/format";
import { OBSERVATION_BY_CODE, quarterLabel } from "@/lib/ehss/model";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import type {
  AreaTrend,
  ContractorStats,
  IssueRow,
} from "@/lib/ehss/summaries";

/** Everything the dashboard shows about one contractor inside the selected
 * timeframe: where the score is heading, how each checklist section scores,
 * and the questions costing the most points. */
export function ContractorDrilldown({
  stats,
  issues,
  priorityAreas,
}: {
  stats: ContractorStats;
  issues: IssueRow[];
  priorityAreas: AreaTrend[];
}) {
  // The weighted scorecard figure — the same number the league table plots.
  const trend = stats.audits
    .filter((a) => a.overall !== null)
    .map((a) => ({ label: quarterLabel(a.quarter), value: a.overall! }));

  return (
    <div>
      <div className="kpi-row">
        <div className="stat-tile">
          <div className="label">
            {stats.audits.length === 1 ? "Score" : "Average score"}
          </div>
          <div className="value">{formatScore(stats.avgScore)}</div>
          <div className="hint">
            <RatingBadge rating={stats.rating} />
          </div>
        </div>
        <div className="stat-tile">
          <div className="label">Latest review</div>
          <div className="value">{formatScore(stats.latestScore)}</div>
          <div className="hint">
            {stats.latestQuarter ? quarterLabel(stats.latestQuarter) : "—"}
          </div>
        </div>
        <div className="stat-tile">
          <div className="label">Direction</div>
          <div className="value">
            {stats.delta === null
              ? "—"
              : `${stats.delta > 0 ? "+" : ""}${stats.delta.toFixed(1)}`}
          </div>
          <div className="hint">
            {stats.delta === null
              ? "needs two reviews"
              : stats.delta > 0
                ? "points gained over the window"
                : stats.delta < 0
                  ? "points lost over the window"
                  : "unchanged"}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <h3 className="panel-title">Score trend</h3>
          <TrendChart points={trend} />
        </div>
        <div>
          <h3 className="panel-title">Discipline scores</h3>
          <table className="data">
            <tbody>
              {stats.disciplineAverages.map((d) => (
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
          <p className="sub" style={{ marginTop: 10 }}>
            <Link href={`/contractors/${stats.contractorId}`}>
              Open full contractor record →
            </Link>{" "}
            · <Link href="/brief">Executive brief →</Link>
          </p>
        </div>
      </div>

      <h3 className="panel-title">Priority improvement areas</h3>
      <p className="sub">
        Checklist areas furthest from the {TARGET_SCORE}% target
      </p>
      {priorityAreas.length === 0 ? (
        <div className="chart-empty">Every area is at target.</div>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Area</th>
              <th className="num">Score</th>
              <th className="num">Gap to {TARGET_SCORE}%</th>
              <th>Movement</th>
            </tr>
          </thead>
          <tbody>
            {priorityAreas.map((a) => (
              <tr key={a.code}>
                <td>
                  <strong>{a.code}</strong> {a.title}
                </td>
                <td className="num">{formatScore(a.latest)}</td>
                <td className="num">{a.gap!.toFixed(1)}</td>
                <td>
                  {a.reviews < 2
                    ? "first review"
                    : a.direction === "flat"
                      ? `no improvement in ${a.reviews} reviews`
                      : `${a.change! > 0 ? "up" : "down"} ${Math.abs(a.change!).toFixed(1)} pts`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="panel-title">Top 5 issues</h3>
      <p className="sub">
        Questions costing the most score in this window — weighted points lost
        (a weight-4 &ldquo;No&rdquo; outranks a weight-1 &ldquo;Partial&rdquo;)
      </p>
      {issues.length === 0 ? (
        <div className="chart-empty">
          No Partial or No answers in this window.
        </div>
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
                <td className="num">
                  {i.occurrences}
                  <span style={{ color: "var(--muted)" }}>
                    {i.noCount > 0 ? ` (${i.noCount} No)` : ""}
                  </span>
                </td>
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
    </div>
  );
}
