"use client";

import { useRef, useState } from "react";

export interface TrendChartPoint {
  label: string; // x label, e.g. "Jan 2026" or an audit date
  value: number; // 0..100
}

/**
 * Single-series score trend line: 2px line, 8px markers with a 2px surface
 * ring, 10%-opacity area wash, crosshair + tooltip on hover (single series,
 * so the card title is the legend).
 */
export function TrendChart({ points }: { points: TrendChartPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return <div className="chart-empty">No finalized audits yet.</div>;
  }

  const W = 560;
  const H = 200;
  const pad = { top: 12, right: 16, bottom: 26, left: 36 };
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;

  const x = (i: number) =>
    pad.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.top + ih - (v / 100) * ih;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `${linePath} L${x(points.length - 1).toFixed(1)},${(pad.top + ih).toFixed(1)}` +
    ` L${x(0).toFixed(1)},${(pad.top + ih).toFixed(1)} Z`;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    points.forEach((_, i) => {
      const d = Math.abs(x(i) - px);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHover(nearest);
  }

  const hovered = hover !== null ? points[hover] : undefined;

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Score trend"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* gridlines: hairline, recessive, clean steps */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(v)}
              y2={y(v)}
              stroke={v === 0 ? "var(--baseline)" : "var(--grid)"}
              strokeWidth={1}
            />
            <text
              x={pad.left - 8}
              y={y(v) + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--muted)"
            >
              {v}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="var(--accent)" opacity={0.1} />
        <path
          d={linePath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* crosshair */}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.top}
            y2={pad.top + ih}
            stroke="var(--baseline)"
            strokeWidth={1}
          />
        )}

        {/* markers: >=8px with a 2px surface ring */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.value)}
            r={4}
            fill="var(--accent)"
            stroke="var(--surface-1)"
            strokeWidth={2}
          />
        ))}

        {/* selective direct label: the latest value only */}
        <text
          x={x(points.length - 1)}
          y={y(points[points.length - 1]!.value) - 10}
          textAnchor={points.length === 1 ? "middle" : "end"}
          fontSize={12}
          fontWeight={650}
          fill="var(--ink-1)"
        >
          {points[points.length - 1]!.value}%
        </text>

        {/* x labels: first and last are enough at this density */}
        <text x={x(0)} y={H - 8} textAnchor="start" fontSize={11} fill="var(--muted)">
          {points[0]!.label}
        </text>
        {points.length > 1 && (
          <text x={x(points.length - 1)} y={H - 8} textAnchor="end" fontSize={11} fill="var(--muted)">
            {points[points.length - 1]!.label}
          </text>
        )}
      </svg>

      {hovered && hover !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: 0,
            transform: `translate(${hover > points.length / 2 ? "-110%" : "10%"}, 0)`,
          }}
        >
          <div className="val">{hovered.value}%</div>
          <div className="lbl">{hovered.label}</div>
        </div>
      )}
    </div>
  );
}
