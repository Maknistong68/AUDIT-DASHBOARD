"use client";

import { useState } from "react";
import { bandColor } from "@/lib/ehss/bands";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { DOMAIN_BY_ID } from "@/lib/ehss/domains";
import { formatScore } from "@/lib/format";
import type { CriticalRiskStat } from "@/lib/ehss/summaries";

/**
 * Critical Risk Control by hazard: a ranked bar per hazardous-work item,
 * worst first, so the focus audits to book next sit at the top.
 *
 * The axis starts at 60 rather than 0 — every hazard scores above that, and
 * a 0-100 axis flattens a 20-point spread into indistinguishable bars. The
 * 90% target is drawn so the truncation cannot mislead about compliance.
 */

const AXIS_MIN = 60;

export function CriticalRiskBars({ stats }: { stats: CriticalRiskStat[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (stats.length === 0) {
    return <div className="chart-empty">No critical-risk audits in scope.</div>;
  }

  const pct = (score: number) =>
    ((Math.max(AXIS_MIN, score) - AXIS_MIN) / (100 - AXIS_MIN)) * 100;

  return (
    <ul className="crc-list">
      {stats.map((r) => {
        const expanded = open === r.id;
        return (
          <li key={r.id} className="crc-row">
            <button
              type="button"
              className="crc-head"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : r.id)}
            >
              <span className="crc-label">
                {r.label}
                <span className="crc-pillar">{DOMAIN_BY_ID[r.domain].label}</span>
              </span>
              <span className="crc-bar" aria-hidden>
                <span
                  className="crc-fill"
                  style={{
                    width: `${pct(r.avg ?? AXIS_MIN)}%`,
                    background: bandColor(r.avg),
                  }}
                />
                <span
                  className="crc-target"
                  style={{ left: `${pct(TARGET_SCORE)}%` }}
                />
              </span>
              <span className="crc-score">{formatScore(r.avg)}</span>
              <span className="crc-meta">
                {r.belowTarget.length}/{r.contractors} below target
              </span>
            </button>
            {expanded && (
              <div className="crc-detail">
                {r.belowTarget.length === 0 ? (
                  <p className="sub" style={{ margin: 0 }}>
                    All {r.contractors} contractor
                    {r.contractors === 1 ? "" : "s"} carrying this hazard are at
                    or above the {TARGET_SCORE}% target.
                  </p>
                ) : (
                  <>
                    <p className="sub" style={{ margin: "0 0 6px" }}>
                      Below target on {r.label.toLowerCase()}, worst first:
                    </p>
                    <ul className="crc-contractors">
                      {r.belowTarget.map((c) => (
                        <li key={c.contractorId}>
                          <i style={{ background: bandColor(c.score) }} />
                          {c.label}
                          <strong>{formatScore(c.score)}</strong>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
