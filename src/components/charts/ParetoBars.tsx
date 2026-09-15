"use client";

import { useState } from "react";

export interface ParetoBarDatum {
  label: string;
  count: number;
  share: number; // percent of total
}

/**
 * Horizontal Pareto of NC classifications: one measure, so a single
 * sequential hue. Bars <=24px thick, 4px-rounded data end, square baseline;
 * value directly labeled at the tip; per-mark hover tooltip with the share.
 */
export function ParetoBars({ data }: { data: ParetoBarDatum[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <div className="chart-empty">No non-compliances recorded.</div>;
  }

  const max = Math.max(...data.map((d) => d.count));
  const BAR = 18;
  const GAP = 10;
  const LABEL_W = 210;
  const VALUE_W = 34;
  const W = 560;
  const plotW = W - LABEL_W - VALUE_W;
  const H = data.length * (BAR + GAP) - GAP + 4;

  // 4px rounded data-end (right), square at the baseline (left).
  const barPath = (w: number, yTop: number) => {
    const r = Math.min(4, w);
    const x0 = LABEL_W;
    return `M${x0},${yTop} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${BAR - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - r} Z`;
  };

  const hovered = hover !== null ? data[hover] : undefined;

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Non-compliance breakdown"
      >
        <line
          x1={LABEL_W}
          x2={LABEL_W}
          y1={0}
          y2={H}
          stroke="var(--baseline)"
          strokeWidth={1}
        />
        {data.map((d, i) => {
          const yTop = i * (BAR + GAP) + 2;
          const w = Math.max((d.count / max) * plotW, 2);
          return (
            <g
              key={d.label}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            >
              {/* hit target bigger than the mark */}
              <rect
                x={0}
                y={yTop - GAP / 2}
                width={W}
                height={BAR + GAP}
                fill="transparent"
              />
              <text
                x={LABEL_W - 10}
                y={yTop + BAR / 2 + 4}
                textAnchor="end"
                fontSize={12}
                fill="var(--ink-2)"
              >
                {d.label.length > 28 ? `${d.label.slice(0, 27)}…` : d.label}
              </text>
              <path
                d={barPath(w, yTop)}
                fill="var(--accent)"
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
              <text
                x={LABEL_W + w + 8}
                y={yTop + BAR / 2 + 4}
                fontSize={12}
                fontWeight={650}
                fill="var(--ink-1)"
              >
                {d.count}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered && hover !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(LABEL_W / W) * 100}%`,
            top: `${(hover / data.length) * 100}%`,
            transform: "translate(8px, -110%)",
          }}
        >
          <div className="val">
            {hovered.count} NC{hovered.count === 1 ? "" : "s"} · {hovered.share}%
          </div>
          <div className="lbl">{hovered.label}</div>
        </div>
      )}
    </div>
  );
}
