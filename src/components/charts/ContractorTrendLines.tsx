"use client";

import { useState } from "react";
import { formatScore } from "@/lib/format";

export interface TrendSeries {
  contractorId: string;
  label: string;
  values: Array<number | null>;
}

/**
 * Score trajectory for every contractor on one quarter axis. This is an
 * *emphasis* chart, not a categorical one: every line is the de-emphasis
 * gray and only the hovered or selected contractor takes the accent, so it
 * stays readable well past the point where distinct hues would fail.
 * Clicking a line selects that contractor.
 */
export function ContractorTrendLines({
  quarters,
  series,
  selectedId,
  onSelect,
}: {
  quarters: string[];
  series: TrendSeries[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  if (quarters.length === 0 || series.length === 0) {
    return <div className="chart-empty">No finalized reviews in scope.</div>;
  }

  const W = 560;
  const H = 240;
  const pad = { top: 14, right: 104, bottom: 26, left: 34 };
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;

  // Scores cluster in a narrow band, so a fixed 0–100 axis would flatten
  // every trajectory into a straight line. Fit the axis to the data with
  // headroom, keeping a floor of 25 points so small moves aren't magnified
  // into drama, and always keeping the 90% target visible.
  const values = series.flatMap((s) =>
    s.values.filter((v): v is number => v !== null),
  );
  const dataMin = values.length ? Math.min(...values) : 0;
  const dataMax = values.length ? Math.max(...values) : 100;
  const centre = (dataMin + dataMax) / 2;
  const span = Math.max(25, dataMax - dataMin + 10);
  let yMin = Math.max(0, Math.floor((centre - span / 2) / 5) * 5);
  let yMax = Math.min(100, Math.ceil((centre + span / 2) / 5) * 5);
  if (yMax < 92) yMax = Math.min(100, yMax + 5);
  if (yMax - yMin < 20) yMin = Math.max(0, yMax - 20);

  const ticks = [0, 1, 2, 3, 4].map(
    (k) => Math.round((yMin + ((yMax - yMin) * k) / 4) * 10) / 10,
  );

  const x = (i: number) =>
    pad.left + (quarters.length === 1 ? iw / 2 : (i / (quarters.length - 1)) * iw);
  const y = (v: number) =>
    pad.top + ih - ((v - yMin) / (yMax - yMin)) * ih;

  const pathFor = (values: Array<number | null>) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const lastValue = (values: Array<number | null>) => {
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i] !== null) return { value: values[i]!, index: i };
    }
    return null;
  };

  // Label only the best and worst end-points, plus whatever is active.
  const ends = series
    .map((s) => ({ s, end: lastValue(s.values) }))
    .filter((e): e is { s: TrendSeries; end: { value: number; index: number } } =>
      Boolean(e.end),
    )
    .sort((a, b) => b.end.value - a.end.value);
  const activeId = hoverId ?? selectedId;
  const labelled = new Set(
    [ends[0]?.s.contractorId, ends[ends.length - 1]?.s.contractorId, activeId].filter(
      Boolean,
    ) as string[],
  );

  const active = series.find((s) => s.contractorId === activeId);
  const activeEnd = active ? lastValue(active.values) : null;

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Contractor score trajectories"
      >
        {ticks.map((v, k) => (
          <g key={v}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(v)}
              y2={y(v)}
              stroke={k === 0 ? "var(--baseline)" : "var(--grid)"}
              strokeWidth={1}
            />
            <text
              x={pad.left - 7}
              y={y(v) + 4}
              textAnchor="end"
              fontSize={10.5}
              fill="var(--muted)"
            >
              {v}
            </text>
          </g>
        ))}
        {/* the 90% compliance target, when it falls inside the axis */}
        {yMin <= 90 && yMax >= 90 && (
          <line
            x1={pad.left}
            x2={W - pad.right}
            y1={y(90)}
            y2={y(90)}
            stroke="var(--status-good)"
            strokeWidth={1}
          />
        )}

        {series.map((s) => {
          const isActive = s.contractorId === activeId;
          return (
            <g
              key={s.contractorId}
              style={{ cursor: "pointer" }}
              onPointerEnter={() => setHoverId(s.contractorId)}
              onPointerLeave={() => setHoverId(null)}
              onClick={() =>
                onSelect(selectedId === s.contractorId ? null : s.contractorId)
              }
            >
              {/* fat invisible stroke: an easy hit target for a 2px line */}
              <path
                d={pathFor(s.values)}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
              />
              <path
                d={pathFor(s.values)}
                fill="none"
                stroke={isActive ? "var(--accent)" : "var(--muted)"}
                strokeWidth={isActive ? 2.5 : 1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={isActive ? 1 : activeId ? 0.28 : 0.5}
              />
            </g>
          );
        })}

        {/* end markers and labels for the extremes and the active line */}
        {(() => {
          // Nudge labels apart when two end-points land on top of each other.
          const shown = ends.filter((e) => labelled.has(e.s.contractorId));
          let lastY = -Infinity;
          return shown
            .slice()
            .sort((a, b) => y(a.end.value) - y(b.end.value))
            .map(({ s, end }) => {
              const isActive = s.contractorId === activeId;
              const wanted = y(end.value) + 4;
              const labelY = Math.max(wanted, lastY + 13);
              lastY = labelY;
              return (
                <g key={`end-${s.contractorId}`}>
                  <circle
                    cx={x(end.index)}
                    cy={y(end.value)}
                    r={4}
                    fill={isActive ? "var(--accent)" : "var(--ink-2)"}
                    stroke="var(--surface-1)"
                    strokeWidth={2}
                  />
                  <text
                    x={x(end.index) + 9}
                    y={labelY}
                    fontSize={11}
                    fontWeight={isActive ? 650 : 400}
                    fill={isActive ? "var(--ink-1)" : "var(--ink-2)"}
                  >
                    {s.label}
                  </text>
                </g>
              );
            });
        })()}

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
        <span>
          <i className="key-line key-accent" /> selected contractor
        </span>
        <span>
          <i className="key-line key-muted" /> other contractors
        </span>
        <span>
          <i className="key-line key-good" /> 90% target
        </span>
      </div>

      {active && activeEnd && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(x(activeEnd.index) / W) * 100}%`,
            top: `${(y(activeEnd.value) / H) * 100}%`,
            transform: "translate(-104%, -120%)",
          }}
        >
          <div className="val">{formatScore(activeEnd.value)}</div>
          <div className="lbl">{active.label}</div>
        </div>
      )}
    </div>
  );
}
