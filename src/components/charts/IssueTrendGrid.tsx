"use client";

import { ISSUE_BY_CODE, type IssueCode } from "@/lib/ehss/issues";

export interface IssueSeries {
  code: IssueCode;
  values: number[];
}

/**
 * How each issue category moves quarter to quarter.
 *
 * Small multiples rather than many lines on one plot. Past about eight
 * series a shared axis becomes a thicket, and plotting only "the top five"
 * would repaint the colours whenever a filter changed the ranking — a
 * reader who learned "orange is subcontractor control" would be misled.
 * One panel per category needs no colour identity at all, because every
 * panel is labelled.
 *
 * The vertical scale is SHARED across panels, so their heights compare
 * directly — which is the entire reason for putting them side by side.
 */
export function IssueTrendGrid({
  quarters,
  series,
}: {
  quarters: string[];
  series: IssueSeries[];
}) {
  const present = series.filter((s) => s.values.some((v) => v > 0));
  if (quarters.length === 0 || present.length === 0) {
    return <div className="chart-empty">No findings in scope.</div>;
  }

  const max = Math.max(1, ...present.flatMap((s) => s.values));
  const W = 150;
  const H = 40;
  const x = (i: number) =>
    quarters.length === 1 ? W / 2 : (i / (quarters.length - 1)) * (W - 8) + 4;
  const y = (v: number) => H - 4 - (v / max) * (H - 10);

  const ranked = [...present].sort(
    (a, b) =>
      b.values.reduce((s, v) => s + v, 0) - a.values.reduce((s, v) => s + v, 0),
  );

  return (
    <>
      <div className="issue-grid">
        {ranked.map((s) => {
          const latest = s.values[s.values.length - 1] ?? 0;
          const first = s.values[0] ?? 0;
          const delta = latest - first;
          return (
            <div className="issue-panel" key={s.code}>
              <div className="issue-panel-head">
                <span className="issue-panel-name">
                  <b>{s.code}</b> {ISSUE_BY_CODE[s.code].label}
                </span>
                <span className="issue-panel-n">{latest}</span>
              </div>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label={`${ISSUE_BY_CODE[s.code].label}: ${quarters
                  .map((q, i) => `${q} ${s.values[i] ?? 0}`)
                  .join(", ")}`}
              >
                <polyline
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1.8}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                />
                <circle
                  cx={x(s.values.length - 1)}
                  cy={y(latest)}
                  r={2.8}
                  fill="var(--accent)"
                  stroke="var(--surface-1)"
                  strokeWidth={1.2}
                />
              </svg>
              <div className="issue-panel-foot">
                {quarters.length < 2 ? (
                  "single quarter"
                ) : (
                  <span
                    style={{
                      color:
                        delta > 0
                          ? "var(--status-critical)"
                          : delta < 0
                            ? "var(--status-good)"
                            : "var(--muted)",
                    }}
                  >
                    {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"}{" "}
                    {delta === 0
                      ? "no change"
                      : `${Math.abs(delta)} since ${quarters[0]!.replace("-", " ")}`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="sub" style={{ marginTop: 12, marginBottom: 0 }}>
        Panels share one vertical scale, so their heights compare directly. A
        finding with several categories is counted under each, so these sum to
        more than the number of findings.
      </p>
    </>
  );
}
