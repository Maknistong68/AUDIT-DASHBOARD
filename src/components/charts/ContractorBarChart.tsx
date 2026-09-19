"use client";

import { useRef, useState } from "react";
import { formatScore } from "@/lib/format";
import { useChartWidth } from "./useChartWidth";
import { BANDS, bandColor } from "@/lib/ehss/bands";

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
}

export const RATING_KEY = BANDS.map((b) => ({
  label: `${b.label} ${b.range}`,
  varName: b.varName,
}));

/**
 * League table of contractors for the selected timeframe. Bars are clickable
 * and keyboard-focusable; selection emphasizes one bar, recedes the rest and
 * drives the floating drill-down.
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
  // Drawn at the container's own width, so type is never scaled down.
  const W = useChartWidth(wrapRef, 720);

  if (data.length === 0) {
    return <div className="chart-empty">No finalized reviews in scope.</div>;
  }

  const BAR = 22;
  const GAP = 14;
  // The name column takes a third of a narrow card but never more than it
  // needs on a wide one, so the bars keep the rest.
  const LABEL_W = Math.min(150, Math.max(92, Math.round(W * 0.3)));
  const VALUE_W = W < 460 ? 48 : 62;
  const TOP = 18; // room for the threshold label
  const plotW = W - LABEL_W - VALUE_W;
  const H = TOP + data.length * (BAR + GAP);

  const x = (v: number) => (Math.max(0, Math.min(100, v)) / 100) * plotW;

  // Rounded data end, square at the baseline — the baseline anchor is what
  // keeps the bar readable as a magnitude, so only the tip is softened.
  const barPath = (w: number, yTop: number) => {
    const r = Math.min(8, w);
    return `M${LABEL_W},${yTop} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${BAR - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - r} Z`;
  };

  const hovered = hover !== null ? data[hover] : undefined;
  // Ellipsis at whatever the name column can actually hold.
  const maxChars = Math.max(8, Math.floor((LABEL_W - 14) / 6.6));

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Contractor scores"
      >
        {/* gridlines at clean steps, recessive */}
        {[25, 50, 75, 100].map((v) => (
          <line
            key={v}
            x1={LABEL_W + x(v)}
            x2={LABEL_W + x(v)}
            y1={TOP}
            y2={H}
            stroke="var(--grid)"
            strokeWidth={1}
          />
        ))}
        {/* baseline */}
        <line
          x1={LABEL_W}
          x2={LABEL_W}
          y1={TOP}
          y2={H}
          stroke="var(--baseline)"
          strokeWidth={1}
        />
        {/* the one threshold worth drawing: Compliant starts at 90% */}
        <line
          x1={LABEL_W + x(90)}
          x2={LABEL_W + x(90)}
          y1={TOP - 6}
          y2={H}
          stroke="var(--status-good)"
          strokeWidth={1}
        />
        <text
          x={LABEL_W + x(90)}
          y={TOP - 10}
          textAnchor="middle"
          fontSize={10.5}
          fill="var(--muted)"
        >
          Compliant 90%
        </text>

        {data.map((d, i) => {
          const yTop = TOP + i * (BAR + GAP) + GAP / 2;
          const selected = selectedId === d.id;
          const dimmed = selectedId !== null && !selected;
          const w = d.value === null ? 0 : Math.max(x(d.value), 2);
          return (
            <g
              key={d.id}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${d.label}, ${formatScore(d.value)}`}
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
              {/* hit target: wider than the mark */}
              <rect
                x={0}
                y={yTop - GAP / 2}
                width={W}
                height={BAR + GAP}
                fill="transparent"
              />
              <text
                x={LABEL_W - 12}
                y={yTop + BAR / 2 + 4}
                textAnchor="end"
                fontSize={12.5}
                fontWeight={selected ? 650 : 400}
                fill={dimmed ? "var(--muted)" : "var(--ink-1)"}
              >
                {d.label.length > maxChars
                  ? `${d.label.slice(0, maxChars - 1)}…`
                  : d.label}
              </text>
              {d.value === null ? (
                <text
                  x={LABEL_W + 8}
                  y={yTop + BAR / 2 + 4}
                  fontSize={12}
                  fill="var(--muted)"
                >
                  no score
                </text>
              ) : (
                <>
                  <path
                    d={barPath(w, yTop)}
                    fill={bandColor(d.value)}
                    opacity={dimmed ? 0.3 : hover === i ? 0.85 : 1}
                  />
                  <text
                    x={LABEL_W + w + 10}
                    y={yTop + BAR / 2 + 4}
                    fontSize={12.5}
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
            left: `${(LABEL_W / W) * 100}%`,
            top: `${((TOP + hover * (BAR + GAP)) / H) * 100}%`,
            transform: "translate(12px, -108%)",
          }}
        >
          <div className="val">{formatScore(hovered.value)}</div>
          <div className="lbl">{hovered.label}</div>
          <div className="lbl">
            {hovered.rating ?? "unrated"} ·{" "}
            {hovered.reviews === 1
              ? "1 review"
              : `mean of ${hovered.reviews} reviews`}
            {hovered.delta !== null &&
              ` · ${hovered.delta > 0 ? "+" : ""}${hovered.delta.toFixed(1)} pts`}
          </div>
        </div>
      )}
    </div>
  );
}
