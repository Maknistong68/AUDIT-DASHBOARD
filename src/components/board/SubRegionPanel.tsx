"use client";

import { bandColor } from "@/lib/ehss/bands";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { formatScore } from "@/lib/format";
import type { BoardPanel, BoardRow } from "@/lib/ehss/summaries";

/**
 * One sub-region's contractors, worst first.
 *
 * Horizontal because the labels are names, and faceted by sub-region because
 * that is the organisation: a project director should see their own patch
 * without first operating a filter.
 *
 * The bar carries the rating band as colour, which is a status scale and
 * means good-or-bad rather than identity — so the score is printed on every
 * row and colour is never the only channel. The 90% target is drawn once per
 * row as a hairline tick, not as a gridline across the panel.
 */
export function SubRegionPanel({
  panel,
  selectedId,
  onSelect,
}: {
  panel: BoardPanel;
  selectedId: string | null;
  onSelect: (row: BoardRow) => void;
}) {
  return (
    <section className="bd-panel">
      <header className="bd-panel-head">
        <h2>{panel.subRegionName}</h2>
        <span className="bd-panel-avg">
          {formatScore(panel.average)}
          <em> average</em>
        </span>
      </header>

      {panel.rows.length === 0 ? (
        <p className="bd-panel-none">No review this quarter.</p>
      ) : (
        <ul className="bd-rows">
          {panel.rows.map((row) => {
            const width = Math.max(1.5, Math.min(100, row.score ?? 0));
            return (
              <li key={row.contractorId}>
                <button
                  type="button"
                  className="bd-row"
                  aria-pressed={selectedId === row.contractorId}
                  onClick={() => onSelect(row)}
                  title={`${row.label} — ${formatScore(row.score)}, ${row.areasBelow} of ${row.areasScored} areas below target`}
                >
                  <span className="bd-row-name">{row.label}</span>
                  <span className="bd-row-track" aria-hidden>
                    <i
                      style={{
                        width: `${width}%`,
                        background: bandColor(row.score),
                      }}
                    />
                    <b style={{ left: `${TARGET_SCORE}%` }} />
                  </span>
                  <span className="bd-row-score">{formatScore(row.score)}</span>
                  <Delta value={row.delta} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Movement since the contractor's own previous review. A first review has
 * none, which reads as a dash rather than a zero. */
function Delta({ value }: { value: number | null }) {
  if (value === null)
    return (
      <span className="bd-row-delta is-none" title="First review">
        —
      </span>
    );
  if (Math.abs(value) < 0.05)
    return (
      <span className="bd-row-delta is-flat" title="No change">
        ±0
      </span>
    );
  const up = value > 0;
  return (
    <span
      className={`bd-row-delta ${up ? "is-up" : "is-down"}`}
      title={`${up ? "Up" : "Down"} ${Math.abs(value).toFixed(1)} points since the previous review`}
    >
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(1)}
    </span>
  );
}
