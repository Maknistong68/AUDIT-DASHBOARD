"use client";

import { useRef, useState } from "react";
import { formatScore } from "@/lib/format";
import { useChartBox } from "./useChartWidth";
import { BANDS, bandColor } from "@/lib/ehss/bands";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";

export interface ContractorBarDatum {
  id: string;
  label: string;
  /** Mean score across the selected timeframe. */
  value: number | null;
  /** Reviews behind the value, shown in the tooltip. */
  reviews: number;
  rating: string | null;
  /** Change across the window, in points. */
  delta: number | null;
  /** Problems below target — the count the bar is worth clicking for. */
  problems: number;
}

export const RATING_KEY = BANDS.map((b) => ({
  label: `${b.label} ${b.range}`,
  varName: b.varName,
}));

/**
 * The dashboard. One chart, every contractor, sized to its container rather
 * than to its data — the row height falls out of the space available, so on
 * a desktop the whole league table is on screen at once with nothing to
 * scroll. Selecting a bar opens the drill-down.
 *
 * Colour is the compliance band, which is an ordered STATUS scale, not
 * identity: the score is printed on every row and the key names every band,
 * so colour is never the only channel.
 */
export function ContractorBarChart({
  data,
  selectedId,
  onSelect,
}: {
  data: ContractorBarDatum[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { width: W, height: H } = useChartBox(
    wrapRef,
    { width: 900, height: 520 },
    // Below the container's own width the SVG would widen the page; a 320px
    // phone leaves this chart about 260px, so the floor has to be under it.
    { width: 200, height: 200 },
  );

  if (data.length === 0) {
    return (
      <div className="chart-wrap" ref={wrapRef}>
        <div className="chart-empty">No finalized reviews in scope.</div>
      </div>
    );
  }

  const TOP = 22; // the threshold label sits above the plot
  const BOT = 4;
  // Rows share whatever height is left. The bar takes 58% of its row, so the
  // gap scales with it and the chart never looks cramped or striped.
  const row = (H - TOP - BOT) / data.length;
  const BAR = Math.max(8, Math.min(34, row * 0.58));

  const LABEL_W = Math.min(190, Math.max(96, Math.round(W * 0.26)));
  const VALUE_W = W < 520 ? 52 : 72;
  const plotW = Math.max(40, W - LABEL_W - VALUE_W);

  const x = (v: number) => (Math.max(0, Math.min(100, v)) / 100) * plotW;

  // Rounded data end, square at the baseline — the baseline anchor is what
  // keeps the bar readable as a magnitude, so only the tip is softened.
  const barPath = (w: number, yTop: number) => {
    const r = Math.min(4, w / 2, BAR / 2);
    return `M${LABEL_W},${yTop} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${BAR - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - r} Z`;
  };

  const hovered = hover !== null ? data[hover] : undefined;
  const nameSize = Math.max(10.5, Math.min(13, BAR * 0.62));
  const maxChars = Math.max(8, Math.floor((LABEL_W - 14) / (nameSize * 0.55)));

  return (
    <div className="chart-wrap chart-fill" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ display: "block" }}
        role="img"
        aria-label="Contractor scores — select a bar for its problems"
      >
        {[25, 50, 75, 100].map((v) => (
          <line
            key={v}
            x1={LABEL_W + x(v)}
            x2={LABEL_W + x(v)}
            y1={TOP}
            y2={H - BOT}
            stroke="var(--grid)"
            strokeWidth={1}
          />
        ))}
        <line
          x1={LABEL_W}
          x2={LABEL_W}
          y1={TOP}
          y2={H - BOT}
          stroke="var(--baseline)"
          strokeWidth={1}
        />
        {/* the one threshold worth drawing */}
        <line
          x1={LABEL_W + x(TARGET_SCORE)}
          x2={LABEL_W + x(TARGET_SCORE)}
          y1={TOP - 7}
          y2={H - BOT}
          stroke="var(--status-good)"
          strokeWidth={1}
        />
        <text
          x={LABEL_W + x(TARGET_SCORE)}
          y={TOP - 11}
          textAnchor="middle"
          fontSize={10.5}
          fill="var(--muted)"
        >
          Compliant {TARGET_SCORE}%
        </text>

        {data.map((d, i) => {
          const yTop = TOP + i * row + (row - BAR) / 2;
          const selected = selectedId === d.id;
          const dimmed = selectedId !== null && !selected;
          const w = d.value === null ? 0 : Math.max(x(d.value), 2);
          return (
            <g
              key={d.id}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${d.label}, ${formatScore(d.value)}, ${d.problems} problems below target`}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(selected ? null : d.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(selected ? null : d.id);
                }
              }}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              {/* hit target spans the whole row, well past the mark */}
              <rect x={0} y={TOP + i * row} width={W} height={row} fill="transparent" />
              {hover === i && !dimmed && (
                <rect
                  x={0}
                  y={TOP + i * row}
                  width={W}
                  height={row}
                  fill="var(--mat-hover)"
                  rx={6}
                />
              )}
              <text
                x={LABEL_W - 12}
                y={yTop + BAR / 2 + nameSize * 0.36}
                textAnchor="end"
                fontSize={nameSize}
                fontWeight={selected ? 650 : 450}
                fill={dimmed ? "var(--muted)" : "var(--ink-1)"}
              >
                {d.label.length > maxChars
                  ? `${d.label.slice(0, maxChars - 1)}…`
                  : d.label}
              </text>
              {d.value === null ? (
                <text
                  x={LABEL_W + 8}
                  y={yTop + BAR / 2 + nameSize * 0.36}
                  fontSize={nameSize}
                  fill="var(--muted)"
                >
                  no score
                </text>
              ) : (
                <>
                  <path
                    d={barPath(w, yTop)}
                    fill={bandColor(d.value)}
                    opacity={dimmed ? 0.28 : 1}
                  />
                  <text
                    x={LABEL_W + w + 10}
                    y={yTop + BAR / 2 + nameSize * 0.36}
                    fontSize={nameSize}
                    fontWeight={650}
                    fill={dimmed ? "var(--muted)" : "var(--ink-1)"}
                  >
                    {formatScore(d.value)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {hovered && hover !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: `${((LABEL_W + 16) / W) * 100}%`,
            top: `${((TOP + hover * row) / H) * 100}%`,
            transform: "translateY(-104%)",
          }}
        >
          <div className="val">{formatScore(hovered.value)}</div>
          <div className="lbl">{hovered.label}</div>
          <div className="lbl">
            {hovered.rating ?? "unrated"}
            {hovered.delta !== null &&
              ` · ${hovered.delta > 0 ? "+" : ""}${hovered.delta.toFixed(1)} pts`}
            {hovered.problems > 0 && ` · ${hovered.problems} below target`}
          </div>
        </div>
      )}
    </div>
  );
}
