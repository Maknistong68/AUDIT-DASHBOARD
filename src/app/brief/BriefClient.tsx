"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useEhss } from "@/lib/ehss/store";
import { contractorLabel } from "@/lib/ehss/mock";
import { RatingBadge } from "@/components/Badges";
import { ScoreMeter } from "@/components/ScoreMeter";
import { formatScore } from "@/lib/format";
import { quarterLabel, ratingFor } from "@/lib/ehss/model";
import {
  DISCIPLINES,
  TARGET_SCORE,
  gapToTarget,
  ordinal,
  rankScores,
} from "@/lib/ehss/disciplines";
import {
  TIMEFRAMES,
  areaTrends,
  contractorStats,
  finalized,
  focusAreas,
  strengthAreas,
  summarizeAll,
  timeframeById,
  topIssues,
  type AreaTrend,
  type TimeframeId,
} from "@/lib/ehss/summaries";

/** One line of plain English for what an area has been doing. */
function movement(t: AreaTrend): string {
  if (t.reviews < 2) return "first review of this area";
  if (t.direction === "flat")
    return `no real improvement across ${t.reviews} reviews`;
  const verb = t.direction === "improving" ? "up" : "down";
  return `${verb} ${Math.abs(t.change!).toFixed(1)} pts across ${t.reviews} reviews`;
}

export function BriefClient() {
  const { subRegions, contractors, audits } = useEhss();
  const [scope, setScope] = useState("all");
  const [timeframe, setTimeframe] = useState<TimeframeId>("last4");

  const allSummaries = useMemo(
    () => summarizeAll(audits, contractors, subRegions),
    [audits, contractors, subRegions],
  );

  const activeContractors = contractors.filter((c) => c.active);

  // Programme ranking, for the "position" line on a contractor brief.
  const programmeStats = useMemo(
    () =>
      contractorStats(
        allSummaries.filter((s) =>
          activeContractors.some((c) => c.id === s.contractorId),
        ),
        timeframe,
      ),
    [allSummaries, activeContractors, timeframe],
  );
  const ranks = rankScores(programmeStats.map((s) => s.avgScore));

  const scoped = useMemo(
    () =>
      scope === "all"
        ? allSummaries.filter((s) =>
            activeContractors.some((c) => c.id === s.contractorId),
          )
        : allSummaries.filter((s) => s.contractorId === scope),
    [allSummaries, scope, activeContractors],
  );

  const stats = contractorStats(scoped, timeframe);
  const windowIds = new Set(stats.flatMap((s) => s.audits.map((a) => a.id)));
  const windowSummaries = scoped.filter((s) => windowIds.has(s.id));

  const headlineScore =
    stats.length === 0
      ? null
      : Math.round(
          (stats
            .filter((s) => s.avgScore !== null)
            .reduce((sum, s) => sum + s.avgScore!, 0) /
            Math.max(1, stats.filter((s) => s.avgScore !== null).length)) * 10,
        ) / 10;

  const delta =
    stats.length === 1
      ? stats[0]!.delta
      : (() => {
          const withDelta = stats.filter((s) => s.delta !== null);
          if (withDelta.length === 0) return null;
          return (
            Math.round(
              (withDelta.reduce((sum, s) => sum + s.delta!, 0) /
                withDelta.length) * 10,
            ) / 10
          );
        })();

  const trends = areaTrends(windowSummaries);
  const focus = focusAreas(trends, 5);
  const strengths = strengthAreas(trends, 4);
  const issues = topIssues(
    audits.filter((a) => windowIds.has(a.id)),
    3,
  );

  const disciplineAverages = DISCIPLINES.map((d) => {
    const values = windowSummaries
      .map((s) => s.disciplineScores[d.id])
      .filter((v): v is number => v !== undefined);
    const avg =
      values.length === 0
        ? null
        : Math.round(
            (values.reduce((sum, v) => sum + v, 0) / values.length) * 10,
          ) / 10;
    return { ...d, avg, gap: gapToTarget(avg) };
  });

  const selected = scope === "all" ? null : contractors.find((c) => c.id === scope);
  const rankIndex = programmeStats.findIndex((s) => s.contractorId === scope);
  const rank = rankIndex >= 0 ? (ranks[rankIndex] ?? null) : null;
  const latestQuarter = stats[0]?.latestQuarter ?? null;

  return (
    <div className="stack">
      <div className="filter-row">
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Brief for</span>
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">All active contractors (programme)</option>
            {activeContractors.map((c) => (
              <option key={c.id} value={c.id}>
                {contractorLabel(c)}
              </option>
            ))}
          </select>
        </label>
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

      <section className="card brief-head">
        <div>
          <h2>
            {selected ? contractorLabel(selected) : "Programme brief"} —{" "}
            {latestQuarter ? quarterLabel(latestQuarter) : "no reviews"}
          </h2>
          <p className="sub">
            {timeframeById(timeframe).label} ·{" "}
            {finalized(windowSummaries).length} review
            {finalized(windowSummaries).length === 1 ? "" : "s"}
            {selected
              ? ` · ${subRegions.find((s) => s.id === selected.subRegionId)?.name}`
              : ` · ${stats.length} contractors`}
          </p>
        </div>
        <div className="brief-headline">
          <div className="brief-score">{formatScore(headlineScore)}</div>
          <div>
            <RatingBadge rating={ratingFor(headlineScore)} />
            <div className="brief-meta">
              {delta === null
                ? "no trend yet"
                : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} pts vs. start of window`}
              {rank !== null && ` · ${ordinal(rank)} of ${programmeStats.length}`}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Where the score comes from</h2>
        <p className="sub">
          Weighted average of the five disciplines · target {TARGET_SCORE}%
        </p>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Discipline</th>
                <th className="num">Weight</th>
                <th>Score</th>
                <th className="num">Gap to {TARGET_SCORE}%</th>
              </tr>
            </thead>
            <tbody>
              {disciplineAverages.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td className="num">{Math.round(d.weight * 100)}%</td>
                  <td style={{ width: 190 }}>
                    <ScoreMeter score={d.avg} />
                  </td>
                  <td className="num">
                    {d.gap === null ? "—" : d.gap === 0 ? "met" : `${d.gap.toFixed(1)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-2">
        <section className="card brief-focus">
          <h2>Focus here</h2>
          <p className="sub">
            Below the {TARGET_SCORE}% target and not improving — biggest gap
            first
          </p>
          {focus.length === 0 ? (
            <div className="chart-empty">
              Nothing is stuck below target in this window.
            </div>
          ) : (
            <ul className="brief-list">
              {focus.map((t) => (
                <li key={t.code}>
                  <div className="brief-item-head">
                    <span className="brief-item-title">{t.title}</span>
                    <span className="brief-item-score">
                      {formatScore(t.latest)}
                    </span>
                  </div>
                  <div className="brief-item-note">
                    {movement(t)} · {t.gap!.toFixed(1)} pts below target
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card brief-good">
          <h2>Working well — keep it up</h2>
          <p className="sub">At or above target, or clearly improving</p>
          {strengths.length === 0 ? (
            <div className="chart-empty">
              No area has reached the target in this window yet.
            </div>
          ) : (
            <ul className="brief-list">
              {strengths.map((t) => (
                <li key={t.code}>
                  <div className="brief-item-head">
                    <span className="brief-item-title">{t.title}</span>
                    <span className="brief-item-score">
                      {formatScore(t.latest)}
                    </span>
                  </div>
                  <div className="brief-item-note">{movement(t)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Biggest single findings</h2>
        <p className="sub">
          The individual checklist questions costing the most score in this
          window
        </p>
        {issues.length === 0 ? (
          <div className="chart-empty">No findings in this window.</div>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <tbody>
                {issues.map((i) => (
                  <tr key={i.questionCode}>
                    <td style={{ width: 70 }}>
                      <strong>{i.questionCode}</strong>
                    </td>
                    <td>
                      {i.questionText}
                      <div className="issue-text">
                        {i.subSectionTitle ?? `Section ${i.sectionCode}`} ·{" "}
                        {i.occurrences} review
                        {i.occurrences === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td className="num">{i.lostPoints} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="sub" style={{ marginTop: 14 }}>
          Need the detail?{" "}
          {selected ? (
            <Link href={`/contractors/${selected.id}`}>
              Open {contractorLabel(selected)}&apos;s full record →
            </Link>
          ) : (
            <Link href="/">Open the dashboard →</Link>
          )}{" "}
          · <Link href="/findings">Findings register →</Link>
        </p>
      </section>
    </div>
  );
}
