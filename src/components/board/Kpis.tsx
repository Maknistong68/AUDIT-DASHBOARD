"use client";

import { bandColor } from "@/lib/ehss/bands";
import { formatScore } from "@/lib/format";
import type { ProgrammeKpis } from "@/lib/ehss/summaries";

/**
 * The four numbers the board leads with.
 *
 * Plain figures, not charts: a single current value is a stat tile, and a
 * one-bar bar chart is the commonest way a dashboard misses its own point.
 * Four is the cap — past that the row stops being a headline and becomes
 * another thing to read.
 */
export function Kpis({ kpi }: { kpi: ProgrammeKpis }) {
  const move =
    kpi.delta === null
      ? null
      : kpi.delta > 0.05
        ? { mark: "▲", tone: "var(--status-good)", text: `+${kpi.delta.toFixed(1)}` }
        : kpi.delta < -0.05
          ? { mark: "▼", tone: "var(--status-critical)", text: kpi.delta.toFixed(1) }
          : { mark: "—", tone: "var(--muted)", text: "no change" };

  return (
    <div className="bd-kpis">
      <div className="bd-kpi">
        <span className="bd-kpi-label">Programme average</span>
        <strong className="bd-kpi-value" style={{ color: bandColor(kpi.average) }}>
          {formatScore(kpi.average)}
        </strong>
        {move && (
          <span className="bd-kpi-note" style={{ color: move.tone }}>
            {move.mark} {move.text}
            <em> since last quarter</em>
          </span>
        )}
      </div>

      <div className="bd-kpi">
        <span className="bd-kpi-label">Below target</span>
        <strong className="bd-kpi-value">
          {kpi.belowTarget}
          <em className="bd-kpi-of"> of {kpi.contractors}</em>
        </strong>
        <span className="bd-kpi-note">contractors under 90%</span>
      </div>

      <div className="bd-kpi">
        <span className="bd-kpi-label">Weakest area</span>
        <strong
          className="bd-kpi-value"
          style={{ color: bandColor(kpi.weakestArea?.score ?? null) }}
        >
          {kpi.weakestArea ? formatScore(kpi.weakestArea.score) : "—"}
        </strong>
        <span className="bd-kpi-note">{kpi.weakestArea?.title ?? "—"}</span>
      </div>

      <div className="bd-kpi">
        <span className="bd-kpi-label">Recurring gaps</span>
        <strong className="bd-kpi-value">{kpi.recurringAreas}</strong>
        <span className="bd-kpi-note">areas weak two audits running</span>
      </div>
    </div>
  );
}
