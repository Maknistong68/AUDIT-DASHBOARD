"use client";

import { useRef, useState } from "react";
import { useChartWidth } from "./useChartWidth";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { formatScore } from "@/lib/format";
import { quarterLabel } from "@/lib/ehss/model";
import type { ProgrammeTrend } from "@/lib/ehss/summaries";

/**
 * Where the programme is going, with the spread it is going there with.
 *
 * Every contractor's own path is drawn first in one recessive ink — they are
 * not a categorical series and no colour claims their identity, they are the
 * cloud the average sits in. The programme mean is the only marked line:
 * accent, 2.5px, a graded wash under it, and a marker per quarter. One
 * series carries meaning, so the card title is the legend and the only extra
 * reference is the 90% target.
 *
 * The y axis is fitted to the data, not pinned to 0–100. Pinned, two
 * quarters of real scores occupy a third of the plot and every movement
 * flattens into the same horizontal line.
 */
export function ProgrammeTrendChart({
  trend,
  height = 212,
}: {
  trend: ProgrammeTrend;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // A 300px floor is wider than the card gives on a 320px phone, and the
  // chart then pushes the page sideways. The plot stays legible well below.
  const W = useChartWidth(wrapRef, 560, 200);

  const n = trend.quarters.length;
  if (n === 0) {
    return <div className="chart-empty">No finalized reviews yet.</div>;
  }

  const H = height;
  const pad = { top: 14, right: 18, bottom: 26, left: 38 };
  const iw = Math.max(40, W - pad.left - pad.right);
  const ih = H - pad.top - pad.bottom;

  const lo = Math.min(trend.min, TARGET_SCORE);
  const hi = Math.max(trend.max, TARGET_SCORE);
  const headroom = Math.max(6, (hi - lo) * 0.14);
  // Ticks a reader recognises: the domain snaps to a round step so the axis
  // reads 40/60/80/100 rather than 35/57/78/100.
  const step = (hi - lo + 2 * headroom) / 3 > 15 ? 20 : 10;
  const yMin = Math.max(0, Math.floor((lo - headroom) / step) * step);
  const yMax = Math.min(100, Math.ceil((hi + headroom) / step) * step);
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax + 0.001; t += step) ticks.push(Math.round(t));

  // One quarter has no line to draw, so the point is placed centre-stage
  // rather than hard against the left edge where it reads as a cut-off.
  const x = (i: number) => (n === 1 ? pad.left + iw / 2 : pad.left + (i / (n - 1)) * iw);
  const y = (v: number) =>
    pad.top + ih - ((v - yMin) / Math.max(1, yMax - yMin)) * ih;

  const path = (pts: Array<{ score: number | null }>) => {
    let d = "";
    let open = false;
    pts.forEach((p, i) => {
      if (p.score === null) {
        open = false;
        return;
      }
      d += `${open ? "L" : "M"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`;
      open = true;
    });
    return d;
  };

  const mean = trend.programme;
  const meanPts = mean
    .map((p, i) => ({ ...p, i }))
    .filter((p): p is typeof p & { score: number } => p.score !== null);
  const areaD =
    meanPts.length > 1
      ? `${path(mean)}L${x(meanPts[meanPts.length - 1]!.i).toFixed(1)},${(pad.top + ih).toFixed(1)}L${x(meanPts[0]!.i).toFixed(1)},${(pad.top + ih).toFixed(1)}Z`
      : "";

  const active = hover ?? null;
  const activePoint = active === null ? null : mean[active];

  return (
    <div className="chart-wrap trend-wrap" ref={wrapRef}>
      <svg
        width={W}
        height={H}
        role="img"
        aria-label={`Programme average by quarter, ${trend.contractors.length} contractors`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="trend-wash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text
              x={pad.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--muted)"
            >
              {t}
            </text>
          </g>
        ))}

        {/* The 90% target: a reference, so it is dashed and unlabelled in
            the plot — the card's footnote names it. */}
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={y(TARGET_SCORE)}
          y2={y(TARGET_SCORE)}
          stroke="var(--status-good)"
          strokeWidth={1.2}
          strokeDasharray="3 4"
          opacity={0.75}
        />

        {areaD && <path d={areaD} fill="url(#trend-wash)" />}

        {trend.contractors.map((c) => (
          <path
            key={c.contractorId}
            d={path(c.points)}
            fill="none"
            stroke="var(--baseline)"
            strokeWidth={1.2}
            strokeLinecap="round"
            opacity={0.45}
          />
        ))}
        <path
          d={path(mean)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {active !== null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={pad.top}
            y2={pad.top + ih}
            stroke="var(--ink-2)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {meanPts.map((p) => (
          <circle
            key={p.quarter}
            cx={x(p.i)}
            cy={y(p.score)}
            r={active === p.i ? 6 : 4.5}
            fill="var(--accent)"
            stroke="var(--surface-1)"
            strokeWidth={2}
          />
        ))}

        {mean.map((p, i) => (
          <text
            key={`x-${p.quarter}`}
            x={x(i)}
            y={H - 8}
            textAnchor={n === 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            fontSize={11}
            fill="var(--muted)"
          >
            {quarterLabel(p.quarter)}
          </text>
        ))}

        {/* Hit targets wider than the marks. */}
        {mean.map((p, i) => (
          <rect
            key={`hit-${p.quarter}`}
            x={x(i) - (n === 1 ? iw / 2 : iw / (2 * (n - 1)))}
            y={pad.top}
            width={n === 1 ? iw : iw / (n - 1)}
            height={ih}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {activePoint && activePoint.score !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(x(active!), 70), W - 70),
            top: y(activePoint.score) - 12,
          }}
        >
          <strong>{formatScore(activePoint.score)}</strong>
          <span>
            {quarterLabel(activePoint.quarter)} · {activePoint.reviews} review
            {activePoint.reviews === 1 ? "" : "s"}
          </span>
        </div>
      )}
    </div>
  );
}
