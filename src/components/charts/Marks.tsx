"use client";

import { bandColor } from "@/lib/ehss/bands";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { formatScore } from "@/lib/format";

/**
 * The small marks every tile and row in the app is built from.
 *
 * Directors read shapes before they read sentences, so a row is a magnitude
 * plus a direction and nothing else. Every mark here carries its number as
 * text as well: the band palette is an ordered status scale, so colour is
 * never allowed to be the only channel.
 *
 * `TargetBar` is the ONE score mark. Anywhere a 0-100 score is drawn — the
 * board's hero, the sub-region rows, the watchlist, the review feed, the
 * reviews table — it is this bar, on the full 0-100 track with the tick at
 * the target. The board used to draw the same quantity two ways (one tile
 * normalised the score to the target instead, so 62.4 was a different length
 * in two tiles on one screen), and a reader cannot compare lengths that do
 * not share a scale.
 */

/**
 * Score against the 90% target — a bullet bar. The fill is the score, the
 * tick is the target, and the track runs the full 0–100 so bars compare
 * across rows. Length, not hue, carries the magnitude.
 */
export function TargetBar({
  score,
  label,
  lead,
  onAccent,
}: {
  score: number | null;
  /** Accessible name; the number beside the bar is rendered by the caller. */
  label: string;
  /** The board's headline meter: the same mark, drawn thicker. */
  lead?: boolean;
  /** Drawn on an accent-filled row, where a band colour has nothing to sit
   * on — the fill switches to the ink that goes on the accent. */
  onAccent?: boolean;
}) {
  return (
    <span
      className={`tbar${lead ? " is-lead" : ""}${onAccent ? " is-on-accent" : ""}`}
      role="img"
      aria-label={`${label}: ${formatScore(score)}, target ${TARGET_SCORE}%`}
    >
      <span className="tbar-track">
        {score !== null && (
          <i
            style={{
              width: `${Math.max(1.5, Math.min(100, score))}%`,
              background: onAccent ? "var(--on-accent)" : bandColor(score),
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

/**
 * How many of a known set, as cells rather than a fraction.
 *
 * "9 of 11" is a number a reader has to divide. Eleven cells with nine filled
 * is the same fact as a shape, and the two that are not filled are visible as
 * holes rather than as a subtraction. Used for review coverage and for
 * recurring areas, where the denominator is small, fixed and meaningful.
 *
 * Capped at `max` cells: past about twenty the cells stop being countable and
 * the strip becomes a bar, at which point the printed fraction is doing the
 * work anyway.
 */
export function DotStrip({
  filled,
  total,
  label,
  tone,
  max = 20,
}: {
  filled: number;
  total: number;
  label: string;
  /** Fill colour for the filled cells; the accent when not given. */
  tone?: string;
  max?: number;
}) {
  if (total <= 0 || total > max) return null;
  return (
    <span
      className="dstrip"
      role="img"
      aria-label={`${label}: ${filled} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <i
          key={i}
          className={i < filled ? "is-on" : undefined}
          style={i < filled && tone ? { background: tone } : undefined}
        />
      ))}
    </span>
  );
}

/**
 * Two parts of one count, side by side.
 *
 * A single figure for "actions" hides the only distinction that matters at
 * board altitude — how many of them are overdue. Two segments share one
 * track, separated by a gap in the surface colour rather than a stroke.
 *
 * The segments carry no inline numerals. The tile prints both counts in
 * order on the line directly above ("9 · 2 overdue"), so the colour is not
 * the only channel, and a numeral set inside a 7px segment would either be
 * clipped or be fighting its own fill for contrast.
 */
export function SplitBar({
  parts,
  label,
}: {
  parts: Array<{ key: string; count: number; tone: string; label: string }>;
  label: string;
}) {
  const total = parts.reduce((n, p) => n + p.count, 0);
  if (total === 0) return null;
  return (
    <span
      className="sbar"
      role="img"
      aria-label={`${label}: ${parts
        .map((p) => `${p.count} ${p.label}`)
        .join(", ")}`}
    >
      {parts
        .filter((p) => p.count > 0)
        .map((p) => (
          <i
            key={p.key}
            style={{ flexGrow: p.count, background: p.tone }}
          />
        ))}
    </span>
  );
}
