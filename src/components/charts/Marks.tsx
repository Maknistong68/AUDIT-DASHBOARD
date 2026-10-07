"use client";

import { bandColor } from "@/lib/ehss/bands";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { formatScore } from "@/lib/format";

/**
 * The two marks the visual drill-down levels are built from.
 *
 * Directors read shapes before they read sentences, so every row in levels
 * one and two is a magnitude plus a direction and nothing else. Both marks
 * carry their number as text as well: the band palette is an ordered status
 * scale, so colour is never allowed to be the only channel.
 */

/**
 * Score against the 90% target — a bullet bar. The fill is the score, the
 * tick is the target, and the track runs the full 0–100 so bars compare
 * across rows. Length, not hue, carries the magnitude.
 */
export function TargetBar({
  score,
  label,
}: {
  score: number | null;
  /** Accessible name; the number beside the bar is rendered by the caller. */
  label: string;
}) {
  return (
    <span
      className="tbar"
      role="img"
      aria-label={`${label}: ${formatScore(score)}, target ${TARGET_SCORE}%`}
    >
      <span className="tbar-track">
        {score !== null && (
          <i
            style={{
              width: `${Math.max(1.5, Math.min(100, score))}%`,
              background: bandColor(score),
            }}
          />
        )}
        <b style={{ left: `${TARGET_SCORE}%` }} />
      </span>
    </span>
  );
}

/**
 * Where a row is heading, as a shape rather than "up 16.7 pts".
 *
 * Fitted to its own data with the target always inside the frame, so a flat
 * line is flat because the score is flat. The endpoint is the only point
 * marked — a dot on every quarter is noise at this size.
 */
export function Spark({
  values,
  width = 56,
  height = 20,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return <span className="spark-none">—</span>;
  }
  const lo = Math.min(...values, TARGET_SCORE);
  const hi = Math.max(...values, TARGET_SCORE);
  const span = Math.max(8, hi - lo);
  const x = (i: number) => (i / (values.length - 1)) * (width - 5) + 2.5;
  const y = (v: number) => height - 3 - ((v - lo) / span) * (height - 6);
  const last = values.length - 1;

  return (
    <svg
      className="rspark"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden
    >
      <line
        x1={0}
        x2={width}
        y1={y(TARGET_SCORE)}
        y2={y(TARGET_SCORE)}
        stroke="var(--status-good)"
        strokeWidth={0.8}
        opacity={0.6}
      />
      <polyline
        fill="none"
        stroke="var(--ink-2)"
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
      />
      <circle
        cx={x(last)}
        cy={y(values[last]!)}
        r={2.2}
        fill={bandColor(values[last]!)}
        stroke="var(--surface-1)"
        strokeWidth={1}
      />
    </svg>
  );
}
