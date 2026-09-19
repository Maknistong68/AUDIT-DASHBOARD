"use client";

import { useState } from "react";
import { OBSERVATION_BY_CODE } from "@/lib/ehss/model";
import type { DomainGapMatrix } from "@/lib/ehss/summaries";

/**
 * SHEW pillar × gap type. One measure (a count) on a grid, so a single
 * sequential hue light→dark; the number is printed in every cell, so the
 * colour is reinforcement rather than the only channel.
 */

// Blue ramp, light → dark. Steps 100/200/300/450/600 of the sequential hue.
const RAMP = ["#e8f1fd", "#cde2fb", "#9ec5f4", "#5598e7", "#2571cc", "#184f95"];
const RAMP_DARK = ["#10233b", "#15355e", "#184f95", "#256abf", "#3987e5", "#6da7ec"];

export function DomainGapHeatmap({ matrix }: { matrix: DomainGapMatrix }) {
  const [hover, setHover] = useState<string | null>(null);

  if (matrix.total === 0 || matrix.domains.length === 0) {
    return <div className="chart-empty">No findings in scope.</div>;
  }

  /** Bucket a count onto the ramp; 0 stays at the lightest step. */
  const step = (count: number) => {
    if (count === 0) return 0;
    const ratio = count / matrix.max;
    return Math.min(RAMP.length - 1, 1 + Math.floor(ratio * (RAMP.length - 1)));
  };

  const cell = (domain: string, observation: string) =>
    matrix.cells.find(
      (c) => c.domain === domain && c.observation === observation,
    );

  return (
    <div className="heatmap-wrap">
      <table className="heatmap">
        <thead>
          <tr>
            <th />
            {matrix.observations.map((o) => (
              <th key={o} scope="col">
                <span className="heat-col">{o}</span>
                <span className="heat-col-sub">
                  {OBSERVATION_BY_CODE[o].label.replace(" gap", "")}
                </span>
              </th>
            ))}
            <th className="num" scope="col">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {matrix.domains.map((d) => (
            <tr key={d.id}>
              <th scope="row">{d.label}</th>
              {matrix.observations.map((o) => {
                const c = cell(d.id, o);
                const count = c?.count ?? 0;
                const s = step(count);
                const key = `${d.id}-${o}`;
                return (
                  <td
                    key={o}
                    className="heat-cell"
                    style={{
                      // Both ramps are declared; the dark one wins under a
                      // dark scheme via the CSS variable below.
                      ["--heat" as string]: RAMP[s],
                      ["--heat-dark" as string]: RAMP_DARK[s],
                      // The ramp inverts between schemes, so the ink does
                      // too: white on the dark end of whichever ramp is live.
                      ["--heat-ink" as string]:
                        s >= 4 ? "#ffffff" : "var(--ink-1)",
                      ["--heat-ink-dark" as string]:
                        s >= 4 ? "#0b1b30" : "#ffffff",
                    }}
                    onPointerEnter={() => setHover(key)}
                    onPointerLeave={() => setHover(null)}
                    title={`${d.label} · ${OBSERVATION_BY_CODE[o].label}: ${count}`}
                  >
                    <span className={hover === key ? "is-hover" : undefined}>
                      {count}
                    </span>
                  </td>
                );
              })}
              <td className="num heat-total">{d.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sub" style={{ marginTop: 10, marginBottom: 0 }}>
        Colour intensity tracks the count, which is printed in every cell.
        Read a row for what kind of gap drives a pillar: implementation gaps
        mean the rules exist and are not followed on site; documentation gaps
        are a paperwork problem.
      </p>
    </div>
  );
}
