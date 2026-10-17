"use client";

import { useRef, useState } from "react";
import { useChartWidth } from "./useChartWidth";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { formatScore } from "@/lib/format";
import type { BoardRow } from "@/lib/ehss/summaries";

/**
 * The quarter's contractors as columns, worst on the left.
 *
 * Magnitude, so: bars, from zero, one accent. The accent marks the column
 * the rest of the board is currently about — the selected contractor, or
 * the weakest one when nothing is selected — and every other column is the
 * same recessive fill. Colour is not identity here and not rank either:
 * change the selection and only the marked column moves.
 *
 * Each column prints its own score, set vertically inside the bar the way a
 * narrow column has to, so the figure never depends on the hover and a
 * printed value always sits beside the shape.
 */
export function ScoreColumns({
  rows,
  selectedId,
  onSelect,
  height = 230,
}: {
  rows: BoardRow[];
  selectedId: string | null;
  onSelect: (row: BoardRow) => void;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const W = useChartWidth(wrapRef, 320, 160);

  if (rows.length === 0) {
    return <div className="chart-empty">No reviews in this quarter.</div>;
  }

  const H = height;
  const pad = { top: 10, right: 2, bottom: 30, left: 2 };
  const iw = Math.max(40, W - pad.left - pad.right);
  const ih = H - pad.top - pad.bottom;

  const band = iw / rows.length;
  // A 2px surface gap between neighbouring fills, and never a bar so wide
  // it reads as a block rather than a mark.
  const bw = Math.max(6, Math.min(26, band - Math.max(2, band * 0.22)));

  const marked =
    selectedId ?? rows.find((r) => r.score !== null)?.contractorId ?? null;

  const h = (score: number | null) =>
    score === null ? 0 : Math.max(3, (Math.max(0, score) / 100) * ih);

  return (
    <div className="chart-wrap cols-wrap" ref={wrapRef}>
      <svg
        width={W}
        height={H}
        role="img"
        aria-label={`Score by contractor, ${rows.length} contractors, target ${TARGET_SCORE}%`}
        onMouseLeave={() => setHover(null)}
      >
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={pad.top + ih - (TARGET_SCORE / 100) * ih}
          y2={pad.top + ih - (TARGET_SCORE / 100) * ih}
          stroke="var(--status-good)"
          strokeWidth={1.2}
          strokeDasharray="3 4"
          opacity={0.7}
        />

        {rows.map((row, i) => {
          const bh = h(row.score);
          const x = pad.left + band * i + (band - bw) / 2;
          const top = pad.top + ih - bh;
          const on = row.contractorId === marked;
          const hot = row.contractorId === hover;
          return (
            <g
              key={row.contractorId}
              className="col-g"
              onMouseEnter={() => setHover(row.contractorId)}
              onClick={() => onSelect(row)}
              role="button"
              tabIndex={0}
              aria-label={`${row.label}: ${formatScore(row.score)}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(row);
                }
              }}
            >
              <rect
                x={pad.left + band * i}
                y={pad.top}
                width={band}
                height={ih + 26}
                fill="transparent"
              />
              <rect
                x={x}
                y={top}
                width={bw}
                height={bh}
                rx={Math.min(6, bw / 2)}
                fill={on ? "var(--accent)" : "var(--col-fill)"}
                stroke={hot && !on ? "var(--ink-2)" : "none"}
                strokeWidth={1}
              />
              {bh > 42 && (
                <text
                  x={x + bw / 2}
                  y={pad.top + ih - 10}
                  transform={`rotate(-90 ${x + bw / 2} ${pad.top + ih - 10})`}
                  textAnchor="start"
                  fontSize={10.5}
                  fontWeight={600}
                  fill={on ? "var(--on-accent)" : "var(--ink-2)"}
                >
                  {formatScore(row.score)}
                </text>
              )}
              <circle
                cx={x + bw / 2}
                cy={pad.top + ih + 15}
                r={Math.min(10, bw / 2 + 2)}
                fill={on ? "var(--accent)" : "var(--col-fill)"}
              />
              <text
                x={x + bw / 2}
                y={pad.top + ih + 18.5}
                textAnchor="middle"
                fontSize={8.5}
                fontWeight={650}
                fill={on ? "var(--on-accent)" : "var(--muted)"}
              >
                {row.name.slice(0, 2).toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>

      {hover && (() => {
        const i = rows.findIndex((r) => r.contractorId === hover);
        const row = rows[i];
        if (!row) return null;
        return (
          <div
            className="chart-tooltip"
            style={{
              left: Math.min(Math.max(pad.left + band * (i + 0.5), 74), W - 74),
              top: Math.max(4, pad.top + ih - h(row.score) - 14),
            }}
          >
            <strong>{formatScore(row.score)}</strong>
            <span>
              {row.label}
              {row.delta !== null &&
                ` · ${row.delta > 0 ? "+" : ""}${row.delta.toFixed(1)} vs last`}
            </span>
          </div>
        );
      })()}
    </div>
  );
}
