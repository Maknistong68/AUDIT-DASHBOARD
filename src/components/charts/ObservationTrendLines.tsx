"use client";

import { useState } from "react";
import { OBSERVATION_BY_CODE, type ObservationCode } from "@/lib/ehss/model";

export interface ObservationSeries {
  code: ObservationCode;
  values: number[];
}

/** Categorical hues in fixed order — validated for both light and dark
 * surfaces (adjacent-pair CVD ΔE 9.1 light / 8.4 dark). Never cycled. */
const SERIES_VAR: Record<string, string> = {
  OB2: "var(--series-1)",
  OB3: "var(--series-2)",
  OB4: "var(--series-3)",
  OB5: "var(--series-4)",
};

/**
 * How the standardized gap classifications move quarter to quarter — four
 * series, so each line is direct-labelled at its end and repeated in the
 * legend (identity never rests on colour alone).
 */
export function ObservationTrendLines({
  quarters,
  series,
}: {
  quarters: string[];
  series: ObservationSeries[];
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (quarters.length === 0) {
    return <div className="chart-empty">No observations in scope.</div>;
  }

  const W = 560;
  const H = 240;
  const pad = { top: 16, right: 52, bottom: 26, left: 34 };
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;

  const max = Math.max(10, ...series.flatMap((s) => s.values));
  const step = Math.ceil(max / 4 / 10) * 10 || 10;
  const top = step * 4;

  const x = (i: number) =>
    pad.left + (quarters.length === 1 ? iw / 2 : (i / (quarters.length - 1)) * iw);
  const y = (v: number) => pad.top + ih - (v / top) * ih;

  const endLabelY: Record<string, number> = {};

  const path = (values: number[]) =>
    values
      .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" ");

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Observation classifications by quarter"
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          let nearest = 0;
          let best = Infinity;
          quarters.forEach((_, i) => {
            const d = Math.abs(x(i) - px);
            if (d < best) {
              best = d;
              nearest = i;
            }
          });
          setHover(nearest);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(step * k)}
              y2={y(step * k)}
              stroke={k === 0 ? "var(--baseline)" : "var(--grid)"}
              strokeWidth={1}
            />
            <text
              x={pad.left - 7}
              y={y(step * k) + 4}
              textAnchor="end"
              fontSize={10.5}
              fill="var(--muted)"
            >
              {step * k}
            </text>
          </g>
        ))}

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

        {(() => {
          const ends = series
            .map((s) => ({ code: s.code, v: s.values[s.values.length - 1]! }))
            .sort((a, b) => y(b.v) - y(a.v));
          let last = Infinity;
          const labelY: Record<string, number> = {};
          for (const e of ends) {
            const wanted = y(e.v) + 4;
            const placed = Math.min(wanted, last - 12);
            labelY[e.code] = placed;
            last = placed;
          }
          Object.assign(endLabelY, labelY);
          return null;
        })()}
        {series.map((s) => (
          <g key={s.code}>
            <path
              d={path(s.values)}
              fill="none"
              stroke={SERIES_VAR[s.code]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.values.map((v, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(v)}
                r={hover === i ? 4.5 : 3.5}
                fill={SERIES_VAR[s.code]}
                stroke="var(--surface-1)"
                strokeWidth={2}
              />
            ))}
            {/* direct label at the series end — required relief for the two
                lighter hues, which sit under 3:1 on the light surface */}
            <text
              x={x(s.values.length - 1) + 9}
              y={endLabelY[s.code] ?? y(s.values[s.values.length - 1]!) + 4}
              fontSize={11}
              fontWeight={650}
              fill="var(--ink-2)"
            >
              {s.code}
            </text>
          </g>
        ))}

        <text x={pad.left} y={H - 7} fontSize={10.5} fill="var(--muted)">
          {quarters[0]!.replace("-", " ")}
        </text>
        {quarters.length > 1 && (
          <text
            x={W - pad.right}
            y={H - 7}
            textAnchor="end"
            fontSize={10.5}
            fill="var(--muted)"
          >
            {quarters[quarters.length - 1]!.replace("-", " ")}
          </text>
        )}
      </svg>

      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.code}>
            <i
              className="key-line"
              style={{ background: SERIES_VAR[s.code] }}
            />
            {s.code} — {OBSERVATION_BY_CODE[s.code].label}
          </span>
        ))}
      </div>

      {hover !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: 0,
            transform: `translate(${hover > quarters.length / 2 ? "-108%" : "10%"}, 4px)`,
          }}
        >
          <div className="lbl" style={{ fontWeight: 650 }}>
            {quarters[hover]!.replace("-", " ")}
          </div>
          {[...series]
            .sort(
              (a, b) => (b.values[hover] ?? 0) - (a.values[hover] ?? 0),
            )
            .map((s) => (
              <div key={s.code} className="tooltip-row">
                <i
                  className="key-line"
                  style={{ background: SERIES_VAR[s.code] }}
                />
                <span className="val">{s.values[hover]}</span>
                <span className="lbl">{s.code}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
