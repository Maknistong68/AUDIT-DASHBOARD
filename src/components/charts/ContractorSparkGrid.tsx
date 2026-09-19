"use client";

import { useState } from "react";
import { formatScore } from "@/lib/format";
import { bandColor } from "@/lib/ehss/bands";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";

export interface SparkSeries {
  contractorId: string;
  label: string;
  values: Array<number | null>;
}

/**
 * One small chart per contractor instead of eleven lines in one frame.
 * Overlaying this many trajectories makes every line anonymous; faceting
 * keeps each one named and readable.
 *
 * All panels share a single y-scale — that is what makes them comparable,
 * and it is the whole point of the form. Each line takes its contractor's
 * current rating colour, and the 90% target is drawn in every panel as the
 * common reference.
 */
export function ContractorSparkGrid({
  quarters,
  series,
  selectedId,
  onSelect,
}: {
  quarters: string[];
  series: SparkSeries[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);

  if (quarters.length === 0 || series.length === 0) {
    return <div className="chart-empty">No finalized reviews in scope.</div>;
  }

  // Shared scale across every panel.
  const all = series.flatMap((s) =>
    s.values.filter((v): v is number => v !== null),
  );
  const dataMin = Math.min(...all);
  const dataMax = Math.max(...all, TARGET_SCORE);
  const yMin = Math.max(0, Math.floor((dataMin - 4) / 5) * 5);
  const yMax = Math.min(100, Math.ceil((dataMax + 4) / 5) * 5);

  const W = 168;
  const H = 46;
  const padX = 3;
  const x = (i: number) =>
    padX +
    (quarters.length === 1
      ? (W - padX * 2) / 2
      : (i / (quarters.length - 1)) * (W - padX * 2));
  const y = (v: number) => H - 4 - ((v - yMin) / (yMax - yMin)) * (H - 8);

  const lastOf = (values: Array<number | null>) => {
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i] !== null) return { value: values[i]!, index: i };
    }
    return null;
  };

  const ordered = [...series].sort((a, b) => {
    const av = lastOf(a.values)?.value ?? -1;
    const bv = lastOf(b.values)?.value ?? -1;
    return bv - av;
  });

  return (
    <div>
      <div className="spark-grid">
        {ordered.map((s) => {
          const end = lastOf(s.values);
          const first = s.values.find((v): v is number => v !== null) ?? null;
          const delta =
            end && first !== null && s.values.filter((v) => v !== null).length > 1
              ? Math.round((end.value - first) * 10) / 10
              : null;
          const colour = bandColor(end?.value ?? null);
          const selected = selectedId === s.contractorId;

          let d = "";
          let pen = false;
          s.values.forEach((v, i) => {
            if (v === null) {
              pen = false;
              return;
            }
            d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
            pen = true;
          });

          return (
            <button
              key={s.contractorId}
              type="button"
              className={`spark${selected ? " is-selected" : ""}`}
              aria-pressed={selected}
              aria-label={`${s.label}, ${formatScore(end?.value ?? null)}${
                delta === null
                  ? ""
                  : `, ${delta > 0 ? "up" : delta < 0 ? "down" : "level"} ${Math.abs(delta)} points`
              }`}
              onClick={() => onSelect(selected ? null : s.contractorId)}
              onPointerEnter={() => setHover(s.contractorId)}
              onPointerLeave={() => setHover(null)}
            >
              <div className="spark-head">
                <span className="spark-name">{s.label}</span>
                <span className="spark-score">
                  {formatScore(end?.value ?? null)}
                </span>
              </div>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                style={{ width: "100%", height: "auto", display: "block" }}
                aria-hidden
              >
                {/* shared 90% reference */}
                <line
                  x1={0}
                  x2={W}
                  y1={y(TARGET_SCORE)}
                  y2={y(TARGET_SCORE)}
                  stroke="var(--band-compliant)"
                  strokeWidth={1}
                  opacity={0.45}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={colour}
                  strokeWidth={2.2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={hover && hover !== s.contractorId ? 0.55 : 1}
                />
                {end && (
                  <circle
                    cx={x(end.index)}
                    cy={y(end.value)}
                    r={3.4}
                    fill={colour}
                    stroke="var(--surface-1)"
                    strokeWidth={2}
                  />
                )}
              </svg>
              <div className="spark-foot">
                {delta === null ? (
                  <span className="spark-flat">single review</span>
                ) : (
                  <span
                    className={
                      delta > 0
                        ? "spark-up"
                        : delta < 0
                          ? "spark-down"
                          : "spark-flat"
                    }
                  >
                    {delta > 0 ? "▲" : delta < 0 ? "▼" : "▬"}{" "}
                    {delta === 0 ? "no change" : `${Math.abs(delta)} pts`}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="chart-legend">
        <span>
          Every panel shares the same {yMin}–{yMax}% scale ·{" "}
          {quarters[0]!.replace("-", " ")} to{" "}
          {quarters[quarters.length - 1]!.replace("-", " ")}
        </span>
        <span>
          <i className="key-line key-good" /> 90% target
        </span>
      </div>
    </div>
  );
}
