"use client";

import { Spark } from "@/components/charts/Marks";
import { bandColor, bandFor } from "@/lib/ehss/bands";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { ISSUE_BY_CODE } from "@/lib/ehss/issues";
import { quarterLabel } from "@/lib/ehss/model";
import { formatScore } from "@/lib/format";
import type {
  AreaStanding,
  AuditSummary,
  IssueCount,
  SectionStanding,
} from "@/lib/ehss/summaries";

/**
 * Drill one — why is this contractor behind.
 *
 * Four pieces and no prose: the headline, WHERE the gap is (section), WHY it
 * is there (cause), and whether it is STICKING. Then the weakest areas, each
 * a way into the detail.
 *
 * A piece with nothing behind it is absent, not explained. With reviews
 * imported as area points there are no causes on record, so "why" simply is
 * not drawn — rather than a heading over an empty box.
 */
export function ContractorView({
  label,
  subRegionName,
  reviews,
  sections,
  areas,
  causes,
  peers,
  compareId,
  onCompare,
  compareAreas,
  onOpenArea,
  actionSlot,
}: {
  label: string;
  subRegionName: string;
  reviews: AuditSummary[];
  sections: SectionStanding[];
  areas: AreaStanding[];
  causes: IssueCount[];
  /**
   * The other contractors in the quarter, so one can be put beside this one.
   *
   * Comparing two was possible only on the checklist matrix, which is not
   * where anyone looks and does not answer the question a director actually
   * asks — "is this one bad, or are they all like this?". The peer is drawn
   * as a second mark on the same row rather than a second panel: two
   * numbers side by side is a comparison, two panels is homework.
   */
  peers: Array<{ contractorId: string; label: string }>;
  compareId: string | null;
  onCompare: (contractorId: string | null) => void;
  /** The comparison contractor's areas, keyed by area code. */
  compareAreas: Record<string, number | null>;
  onOpenArea: (area: AreaStanding) => void;
  /** The register for this contractor, built by the page — this view is a
   * read of the audit and knows nothing about actions. */
  actionSlot?: React.ReactNode;
}) {
  const series = reviews
    .map((r) => r.total)
    .filter((v): v is number => v !== null);
  const score = series[series.length - 1] ?? null;
  const delta =
    series.length >= 2
      ? Math.round((score! - series[series.length - 2]!) * 100) / 100
      : null;
  const band = bandFor(score);

  const recurring = areas.filter((a) => a.recurring).length;
  const fresh = areas.filter((a) => a.isNew).length;
  const met = areas.filter((a) => a.met).length;
  const weakest = areas
    .filter((a) => !a.met)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 6);

  return (
    <div className="dv">
      {/* ---- the headline */}
      <div className="dv-hero">
        <div>
          <span className="dv-hero-score" style={{ color: bandColor(score) }}>
            {formatScore(score)}
          </span>
          <span className="dv-hero-band">{band?.label ?? "Not scored"}</span>
        </div>
        <div className="dv-hero-side">
          {delta !== null && (
            <span
              className={`dv-move ${delta > 0.05 ? "is-up" : delta < -0.05 ? "is-down" : "is-flat"}`}
            >
              {delta > 0.05 ? "▲" : delta < -0.05 ? "▼" : "—"}{" "}
              {Math.abs(delta).toFixed(1)}
            </span>
          )}
          {series.length >= 2 && <Spark values={series} width={76} height={26} />}
          <span className="dv-hero-sub">
            {subRegionName} · {reviews.length} review
            {reviews.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* ---- where */}
      <section className="dv-block">
        <h4 className="dv-h">Where</h4>
        <ul className="dv-bars">
          {sections.map((s) => (
            <li key={s.code}>
              <span className="dv-bar-name">{s.shortTitle}</span>
              <span className="dv-bar-track" aria-hidden>
                <i
                  style={{
                    width: `${Math.max(1.5, Math.min(100, s.score ?? 0))}%`,
                    background: bandColor(s.score),
                  }}
                />
                <b style={{ left: `${TARGET_SCORE}%` }} />
              </span>
              <span className="dv-bar-val">{formatScore(s.score)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- why: only when causes have been recorded */}
      {causes.length > 0 && (
        <section className="dv-block">
          <h4 className="dv-h">Why</h4>
          <ul className="dv-bars">
            {causes.slice(0, 7).map((c) => {
              const max = Math.max(...causes.map((x) => x.count));
              return (
                <li key={c.code}>
                  <span className="dv-bar-name">
                    {ISSUE_BY_CODE[c.code].label}
                  </span>
                  <span className="dv-bar-track" aria-hidden>
                    <i
                      style={{
                        width: `${(c.count / max) * 100}%`,
                        background: "var(--accent)",
                      }}
                    />
                  </span>
                  <span className="dv-bar-val">{c.count}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ---- is it sticking: needs two reviews to mean anything. With one,
              every gap would read as "new", which is not a finding about the
              contractor but about how much history we hold. */}
      {reviews.length >= 2 && (
      <section className="dv-block">
        <h4 className="dv-h">Is it sticking</h4>
        <div className="dv-split">
          <span className="dv-chip is-bad">
            <strong>{recurring}</strong> recurring
          </span>
          <span className="dv-chip is-warn">
            <strong>{fresh}</strong> new
          </span>
          <span className="dv-chip is-good">
            <strong>{met}</strong> at target
          </span>
        </div>
      </section>
      )}

      {/* ---- the way down */}
      {weakest.length > 0 && (
        <section className="dv-block">
          <div className="dv-h-row">
            <h4 className="dv-h">Weakest areas</h4>
            {peers.length > 0 && (
              <label className="dv-compare">
                <span>vs</span>
                <select
                  value={compareId ?? ""}
                  onChange={(e) => onCompare(e.target.value || null)}
                >
                  <option value="">nobody</option>
                  {peers.map((peer) => (
                    <option key={peer.contractorId} value={peer.contractorId}>
                      {peer.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <ul className="dv-areas">
            {weakest.map((a) => {
              const peer = compareId ? compareAreas[a.code] : undefined;
              const diff =
                peer !== undefined && peer !== null && a.score !== null
                  ? Math.round((a.score - peer) * 10) / 10
                  : null;
              return (
                <li key={a.code}>
                  <button type="button" onClick={() => onOpenArea(a)}>
                    <span
                      className="dv-dot"
                      style={{ background: bandColor(a.score) }}
                      aria-hidden
                    />
                    <span className="dv-area-name">{a.title}</span>
                    {a.recurring && <span className="dv-tag">recurring</span>}
                    {compareId && (
                      <span
                        className={`dv-peer${diff !== null && diff < 0 ? " is-behind" : ""}`}
                        title={`The comparison contractor scores ${formatScore(peer ?? null)} here`}
                      >
                        {formatScore(peer ?? null)}
                      </span>
                    )}
                    <span className="dv-area-val">{formatScore(a.score)}</span>
                    <span className="dv-go" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {actionSlot}

      {reviews.length > 0 && (
        <p className="dv-foot">
          Latest review {quarterLabel(reviews[reviews.length - 1]!.quarter)}
        </p>
      )}
    </div>
  );
}
