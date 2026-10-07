"use client";

import { useRef } from "react";
import { useChartBox } from "@/components/charts/useChartWidth";
import { bandColor } from "@/lib/ehss/bands";
import { Spark, TargetBar } from "@/components/charts/Marks";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { quarterLabel } from "@/lib/ehss/model";
import { formatScore } from "@/lib/format";
import type {
  ContractorStats,
  FindingMovement,
  ProblemRow,
} from "@/lib/ehss/summaries";

const KIND_LABEL: Record<ProblemRow["kind"], string> = {
  area: "Checklist area",
  hazard: "Critical risk",
  question: "Question",
};

/** ▲ / ▼ / — for where a problem is heading. */
function Direction({ direction }: { direction: ProblemRow["direction"] }) {
  if (direction === null) return null;
  const mark = direction === "improving" ? "▲" : direction === "declining" ? "▼" : "—";
  const tone =
    direction === "improving"
      ? "var(--status-good)"
      : direction === "declining"
        ? "var(--status-critical)"
        : "var(--muted)";
  return (
    <span aria-hidden style={{ color: tone, fontSize: 11 }}>
      {mark}
    </span>
  );
}

/**
 * Drill-down level 1 — one contractor, and what is wrong with it.
 *
 * Deliberately almost wordless: the left rail is the score and its five
 * disciplines, the right is the ranked list of problems. Every row leads
 * somewhere. The list is capped at what fits, because a problem list you
 * have to scroll is a list nobody finishes.
 */
export function ContractorPanel({
  stats,
  problems,
  movement,
  onOpenProblem,
}: {
  stats: ContractorStats;
  problems: ProblemRow[];
  movement: FindingMovement;
  onOpenProblem: (problem: ProblemRow) => void;
}) {
  const trend = stats.audits
    .filter((a) => a.overall !== null)
    .map((a) => ({ quarter: a.quarter, value: a.overall! }));

  // A real trend chart rather than a token sparkline: drawn at the rail's
  // measured size, so it fills the space and its type is 1:1 rather than
  // scaled by a viewBox. The trajectory is what a director asks about, so
  // it gets the room.
  const plotRef = useRef<HTMLDivElement>(null);
  const { width: PW, height: PH } = useChartBox(
    plotRef,
    { width: 196, height: 150 },
    { width: 120, height: 90 },
  );

  const values = trend.map((t) => t.value);
  const lo = Math.min(...values, TARGET_SCORE) - 2;
  const hi = Math.max(...values, TARGET_SCORE) + 2;
  const span = Math.max(10, hi - lo);
  const TOP = 20; // room for the endpoint label
  const BOT = 18; // room for the quarter labels
  const y = (v: number) => PH - BOT - ((v - lo) / span) * (PH - TOP - BOT);
  const x = (i: number) =>
    trend.length === 1 ? PW / 2 : 6 + (i / (trend.length - 1)) * (PW - 16);
  const last = trend.length - 1;

  return (
    <div className="dd">
      <aside className="dd-rail">
        <div className="dd-hero">
          <div className="dd-score" style={{ color: bandColor(stats.avgScore) }}>
            {formatScore(stats.avgScore)}
          </div>
          <div className="dd-rating">{stats.rating ?? "unrated"}</div>
          {stats.delta !== null && (
            <div
              className="dd-delta"
              style={{
                color:
                  stats.delta > 0
                    ? "var(--status-good)"
                    : stats.delta < 0
                      ? "var(--status-critical)"
                      : "var(--muted)",
              }}
            >
              {stats.delta > 0 ? "▲" : stats.delta < 0 ? "▼" : "—"}{" "}
              {stats.delta > 0 ? "+" : ""}
              {stats.delta.toFixed(1)} pts
            </div>
          )}
        </div>

        {trend.length > 1 && (
          <div className="dd-plot" ref={plotRef}>
            <svg
              width={PW}
              height={PH}
              viewBox={`0 0 ${PW} ${PH}`}
              role="img"
              aria-label={`Trend: ${trend.map((t) => `${quarterLabel(t.quarter)} ${t.value.toFixed(1)} percent`).join(", ")}`}
            >
              <line
                x1={0}
                x2={PW}
                y1={y(TARGET_SCORE)}
                y2={y(TARGET_SCORE)}
                stroke="var(--status-good)"
                strokeWidth={1}
              />
              {/* Left-anchored: the endpoint dot and its value own the
                  right edge, and at a score near 90 they would collide. */}
              <text
                x={0}
                y={y(TARGET_SCORE) - 5}
                textAnchor="start"
                fontSize={9.5}
                fill="var(--muted)"
              >
                target {TARGET_SCORE}%
              </text>
              <polyline
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={trend.map((t, i) => `${x(i)},${y(t.value)}`).join(" ")}
              />
              {trend.map((t, i) => (
                <circle
                  key={t.quarter}
                  cx={x(i)}
                  cy={y(t.value)}
                  r={i === last ? 4.5 : 2.5}
                  fill={i === last ? bandColor(t.value) : "var(--accent)"}
                  stroke="var(--surface-1)"
                  strokeWidth={i === last ? 2 : 0}
                />
              ))}
              {/* Only the endpoint is labelled — a number on every point is noise. */}
              <text
                x={x(last)}
                y={y(trend[last]!.value) - 11}
                textAnchor="end"
                fontSize={12}
                fontWeight={680}
                fill="var(--ink-1)"
              >
                {trend[last]!.value.toFixed(1)}
              </text>
              {trend.map((t, i) => (
                <text
                  key={t.quarter}
                  x={x(i)}
                  y={PH - 4}
                  textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
                  fontSize={9.5}
                  fill="var(--muted)"
                >
                  {quarterLabel(t.quarter).replace(" 20", " ")}
                </text>
              ))}
            </svg>
          </div>
        )}

        <ul className="dd-disc">
          {stats.disciplineAverages.map((d) => (
            <li key={d.id}>
              <span className="dd-disc-name">{d.shortName}</span>
              <span className="dd-disc-bar" aria-hidden>
                <i style={{
                  width: `${d.avg ?? 0}%`,
                  background: bandColor(d.avg),
                }} />
              </span>
              <span className="dd-disc-val">{formatScore(d.avg)}</span>
            </li>
          ))}
        </ul>
      </aside>

      <section className="dd-main">
        <ul className="dd-move" aria-label="Movement since the last review">
          <li className="is-good">
            <strong>{movement.closedLatest}</strong>
            <span>closed since last review</span>
          </li>
          <li className="is-good">
            <strong>{movement.improving}</strong>
            <span>improving</span>
          </li>
          <li className={movement.recurring > 0 ? "is-bad" : undefined}>
            <strong>{movement.recurring}</strong>
            <span>open 3+ reviews</span>
          </li>
          <li className={movement.reopened > 0 ? "is-bad" : undefined}>
            <strong>{movement.reopened}</strong>
            <span>came back</span>
          </li>
        </ul>

        <h3 className="dd-h">
          Problems
          <span className="dd-h-note">
            {problems.length === 0
              ? "nothing below target"
              : `worst first · below the ${TARGET_SCORE}% target`}
          </span>
        </h3>

        {problems.length === 0 ? (
          <div className="chart-empty">Every area is at or above target.</div>
        ) : (
          <ul className="dd-problems">
            {problems.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onOpenProblem(p)}>
                  <span
                    className="dd-p-mark"
                    aria-hidden
                    style={{
                      background:
                        p.score === null
                          ? "var(--status-serious)"
                          : bandColor(p.score),
                    }}
                  />
                  <span className="dd-p-body">
                    <span className="dd-p-label">
                      {(p.reopened || p.streak >= 3) && (
                        <span
                          className={`dd-p-flag ${p.reopened ? "is-back" : "is-stuck"}`}
                        >
                          {p.reopened ? "↻ back" : `↻ ${p.streak}`}
                        </span>
                      )}
                      {p.label}
                    </span>
                    <TargetBar score={p.score} label={p.label} />
                  </span>
                  <span className="dd-p-num">
                    <strong style={{ color: bandColor(p.score) }}>
                      {p.score === null
                        ? `−${p.gap.toFixed(0)}`
                        : `${p.score.toFixed(0)}%`}
                    </strong>
                  </span>
                  <Spark values={p.series} />
                  <span className="dd-p-go" aria-hidden>›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
