"use client";

import { useRef } from "react";
import { useChartWidth } from "@/components/charts/useChartWidth";
import { GAP_CATEGORIES, type IssueCode } from "@/lib/ehss/issues";

const ROW = 30;
const BAR = 22;
const COUNT_W = 44;
/** A rough width for the 12px label, to pick the ink that sits on the bar. */
const labelWidth = (text: string) => text.length * 6.6 + 24;

/**
 * One bar per gap cause for the rows on screen: label on the bar, count at
 * its end, all scaled to the largest. Neutral ink; the one cause the list is
 * filtered to takes the accent. Clicking a bar filters to its cause, and
 * clicking it again lifts the filter. Causes are multi-select, so the bars
 * add up to more than the number of rows.
 */
export function CauseChart({
  counts,
  active,
  onPick,
}: {
  counts: { code: IssueCode; count: number }[];
  active: IssueCode | undefined;
  onPick: (code: IssueCode | undefined) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useChartWidth(ref, 320, 240);
  const track = width - COUNT_W;
  const max = Math.max(1, ...counts.map((c) => c.count));
  const label = (code: IssueCode) =>
    GAP_CATEGORIES.find((c) => c.code === code)?.label ?? code;

  return (
    <div ref={ref} className="obs-chart">
      <svg
        width={width}
        height={counts.length * ROW}
        role="group"
        aria-label="Observations by cause"
      >
        {counts.map(({ code, count }, i) => {
          const y = i * ROW + (ROW - BAR) / 2;
          const w = count === 0 ? 0 : Math.max(4, (count / max) * track);
          const on = code === active;
          const text = `${code} ${label(code)}`;
          const inside = w >= labelWidth(text);
          return (
            <g
              key={code}
              className="obs-bar"
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={`${label(code)}, ${count}`}
              onClick={() => onPick(on ? undefined : code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(on ? undefined : code);
                }
              }}
            >
              <rect x={0} y={i * ROW} width={width} height={ROW} className="obs-bar-hit" />
              <rect x={0} y={y} width={track} height={BAR} rx={6} className="obs-bar-track" />
              <rect
                x={0}
                y={y}
                width={w}
                height={BAR}
                rx={6}
                className={on ? "obs-bar-fill on" : "obs-bar-fill"}
              />
              <text
                x={10}
                y={y + BAR / 2}
                dominantBaseline="central"
                className={on && inside ? "obs-bar-label on" : "obs-bar-label"}
              >
                {text}
              </text>
              <text
                x={width}
                y={y + BAR / 2}
                dominantBaseline="central"
                textAnchor="end"
                className="obs-bar-count"
              >
                {count}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
