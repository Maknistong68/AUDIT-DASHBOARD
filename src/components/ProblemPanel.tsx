"use client";

import { bandColor } from "@/lib/ehss/bands";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import {
  OBSERVATION_BY_CODE,
  OBSERVATION_OPTIONS,
  quarterLabel,
} from "@/lib/ehss/model";
import { formatScore } from "@/lib/format";
import type {
  EvidenceRow,
  ProblemPeer,
  ProblemRow,
} from "@/lib/ehss/summaries";

/**
 * Drill-down level 2 — the evidence behind one problem.
 *
 * This is the bottom of the drill: what the auditor actually recorded, and
 * in which quarter. Below this there is only the audit itself, which is a
 * page rather than a panel.
 */
export function ProblemPanel({
  problem,
  evidence,
  peer,
}: {
  problem: ProblemRow;
  evidence: EvidenceRow[];
  peer: ProblemPeer | null;
}) {
  const isScoreSeries = problem.kind === "hazard";

  // What KIND of gap this is. The observation codes exist to answer exactly
  // this: a wall of OB2s is a paperwork problem, a wall of OB3s means the
  // procedure exists and site is not following it. Different fix, so it is
  // worth the rail space.
  const mix = OBSERVATION_OPTIONS.filter((o) => o.gap)
    .map((o) => ({
      code: o.code,
      label: o.label.replace(" gap", ""),
      count: evidence.filter((e) => e.observation === o.code).length,
    }))
    .filter((o) => o.count > 0)
    .sort((a, b) => b.count - a.count);
  const mixTotal = mix.reduce((sum, o) => sum + o.count, 0);

  return (
    <div className="dd dd-l2">
      <aside className="dd-rail">
        <div className="dd-hero">
          {problem.score === null ? (
            <>
              <div className="dd-score" style={{ color: "var(--status-serious)" }}>
                {problem.gap.toFixed(1)}
              </div>
              <div className="dd-rating">weighted points lost</div>
            </>
          ) : (
            <>
              <div className="dd-score" style={{ color: bandColor(problem.score) }}>
                {formatScore(problem.score)}
              </div>
              <div className="dd-rating">
                {problem.gap.toFixed(1)} below the {TARGET_SCORE}% target
              </div>
            </>
          )}
          <div className="dd-delta" style={{ color: "var(--muted)" }}>
            {problem.note}
          </div>
        </div>
        <p className="dd-rail-note">{problem.label}</p>

        {peer && (
          <div className="dd-peer">
            <h4>{peer.label}</h4>
            <div className="dd-peer-row">
              <span className="dd-peer-val">
                {peer.suffix === "%"
                  ? `${peer.value.toFixed(1)}%`
                  : `${peer.value}${peer.suffix}`}
              </span>
              {peer.delta !== null && (
                <span
                  className="dd-peer-delta"
                  style={{
                    color:
                      peer.delta >= 0
                        ? "var(--status-good)"
                        : "var(--status-critical)",
                  }}
                >
                  {peer.delta >= 0 ? "▲" : "▼"} {Math.abs(peer.delta).toFixed(1)}{" "}
                  {peer.delta >= 0 ? "above" : "below"}
                </span>
              )}
            </div>
          </div>
        )}

        {mix.length > 0 && (
          <div className="dd-mix">
            <h4>Kind of gap</h4>
            <ul>
              {mix.map((o) => (
                <li key={o.code}>
                  <span className="dd-mix-label">
                    <strong>{o.code}</strong> {o.label}
                  </span>
                  <span className="dd-mix-bar" aria-hidden>
                    <i style={{ width: `${(o.count / mixTotal) * 100}%` }} />
                  </span>
                  <span className="dd-mix-n">{o.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <section className="dd-main">
        <h3 className="dd-h">
          {isScoreSeries ? "Score by quarter" : "What was recorded"}
          <span className="dd-h-note">
            {isScoreSeries
              ? "this contractor, newest first"
              : `${evidence.length} finding${evidence.length === 1 ? "" : "s"}, newest first`}
          </span>
        </h3>

        {evidence.length === 0 ? (
          <div className="chart-empty">
            Nothing recorded against this in the selected timeframe.
          </div>
        ) : isScoreSeries ? (
          <ul className="dd-series">
            {evidence.map((e) => (
              <li key={e.quarter}>
                <span className="dd-series-q">{quarterLabel(e.quarter)}</span>
                <span className="dd-series-bar" aria-hidden>
                  <i
                    style={{
                      width: `${e.score ?? 0}%`,
                      background: bandColor(e.score),
                    }}
                  />
                  <b style={{ left: `${TARGET_SCORE}%` }} />
                </span>
                <span className="dd-series-val">{formatScore(e.score)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="dd-evidence">
            {evidence.map((e, i) => (
              <li key={`${e.quarter}-${e.code}-${i}`}>
                <span className="dd-e-q">{quarterLabel(e.quarter)}</span>
                <span
                  className={`dd-e-answer is-${e.answer}`}
                  title={e.answer === "no" ? "Not met" : "Partially met"}
                >
                  {e.answer === "no" ? "No" : "Partial"}
                </span>
                <span className="dd-e-body">
                  <span className="dd-e-text">{e.text}</span>
                  <span className="dd-e-meta">
                    {e.code}
                    {e.weight !== null && ` · weight ${e.weight}`}
                    {e.observation &&
                      ` · ${e.observation} ${OBSERVATION_BY_CODE[e.observation].label}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
