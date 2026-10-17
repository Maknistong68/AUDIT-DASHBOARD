"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { bandColor, bandFor } from "@/lib/ehss/bands";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { formatScore } from "@/lib/format";
import { quarterLabel } from "@/lib/ehss/model";
import type {
  AuditSummary,
  BoardPanel,
  BoardRow,
  SectionMove,
} from "@/lib/ehss/summaries";

/** The corner arrow: a tile's heading is a promise that there is more of
 * this somewhere, and this is where. It always goes somewhere real — an
 * arrow that opens nothing is the worst affordance on a dashboard. */
export function GoLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="bn-go" href={href} aria-label={label} title={label}>
      <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden>
        <path
          d="M4 10 10 4M5 4h5v5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}

/** A tile. One surface, one job, a heading and whatever the job needs. */
export function Card({
  title,
  note,
  action,
  wide,
  className,
  children,
}: {
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`bn-card${wide ? " is-wide" : ""}${className ? ` ${className}` : ""}`}>
      <header className="bn-card-head">
        <div>
          <h2>{title}</h2>
          {note && <p>{note}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/**
 * Movement, as a chip. Up is good here — this is a compliance score, not a
 * bill — so the arrow and the colour agree, and the sign is printed as well
 * because an arrow alone is a shape with two readings.
 */
export function Delta({ value, suffix }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="bn-delta is-flat">new</span>;
  const flat = Math.abs(value) < 0.05;
  const cls = flat ? "is-flat" : value > 0 ? "is-up" : "is-down";
  return (
    <span className={`bn-delta ${cls}`}>
      {flat ? "–" : value > 0 ? "▲" : "▼"} {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}

/**
 * The three thirds of the checklist, each with where it stands and which way
 * it moved. Section titles are the short ones a director would say out loud;
 * the checklist's own ("Process & Procedures (Assessed on Site)") truncate.
 */
export function SectionChips({ moves }: { moves: SectionMove[] }) {
  if (moves.length === 0) return null;
  return (
    <div className="bn-chips">
      {moves.map((m) => (
        <div className="bn-chip" key={m.code}>
          <span className="bn-chip-top">
            <i style={{ background: bandColor(m.score) }} aria-hidden />
            <b>{m.shortTitle}</b>
          </span>
          <span className="bn-chip-val">
            <strong>{formatScore(m.score)}</strong>
            <Delta value={m.delta} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** A headline figure with one line of context under it. */
export function StatTile({
  label,
  value,
  note,
  tone,
  delta,
  className,
}: {
  label: string;
  value: ReactNode;
  note: ReactNode;
  tone?: string;
  delta?: number | null;
  className?: string;
}) {
  return (
    <section className={`bn-card bn-stat${className ? ` ${className}` : ""}`}>
      <header className="bn-card-head">
        <h2>{label}</h2>
        {delta !== undefined && <Delta value={delta} />}
      </header>
      <strong className="bn-stat-value" style={tone ? { color: tone } : undefined}>
        {value}
      </strong>
      <p className="bn-stat-note">{note}</p>
    </section>
  );
}

/** What has been audited lately, and how it went. */
export function ReviewFeed({
  reviews,
  onSelect,
}: {
  reviews: AuditSummary[];
  onSelect: (contractorId: string) => void;
}) {
  if (reviews.length === 0) {
    return <div className="chart-empty">No finalized reviews yet.</div>;
  }
  return (
    <ul className="bn-feed">
      {reviews.map((r) => {
        const band = bandFor(r.overall);
        return (
          <li key={r.id}>
            <button type="button" onClick={() => onSelect(r.contractorId)}>
              <span className="bn-feed-mark" aria-hidden>
                {r.contractorName.slice(0, 2).toUpperCase()}
              </span>
              <span className="bn-feed-id">
                <b>
                  {r.contractorName} ({r.contractorCode})
                </b>
                <em>
                  {r.subRegionName} · {quarterLabel(r.quarter)}
                </em>
              </span>
              <span className="bn-feed-score">
                <b style={{ color: bandColor(r.overall) }}>
                  {formatScore(r.overall)}
                </b>
                {band && <em className={`bn-tag band-${band.id}`}>{band.label}</em>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Each sub-region against the 90% target. Two bars, not a chart: a
 * director's own patch and the other one, with the distance left to run
 * printed rather than inferred from a length.
 */
export function TargetGoals({
  panels,
  programme,
}: {
  panels: BoardPanel[];
  /** The whole programme, as the row the two sub-regions sit either side
   * of — without it each director reads their own bar with nothing to
   * read it against. */
  programme: number | null;
}) {
  if (panels.length === 0) return <div className="chart-empty">—</div>;
  const rows = [
    ...panels.map((p) => ({
      id: p.subRegionId,
      name: p.subRegionName,
      note: `${p.rows.length} contractor${p.rows.length === 1 ? "" : "s"}`,
      score: p.average,
      lead: false,
    })),
    {
      id: "programme",
      name: "Programme",
      note: `${panels.reduce((n, p) => n + p.rows.length, 0)} contractors`,
      score: programme,
      lead: true,
    },
  ];
  return (
    <ul className="bn-goals">
      {rows.map((p) => {
        const pct = p.score === null ? 0 : Math.min(100, (p.score / TARGET_SCORE) * 100);
        return (
          <li key={p.id} className={p.lead ? "is-lead" : undefined}>
            <span className="bn-goal-track">
              <i style={{ width: `${Math.max(2, pct)}%` }} />
            </span>
            <span className="bn-goal-foot">
              <b>{p.name}</b>
              <em>{p.note}</em>
              <span className="spacer" />
              <strong>{formatScore(p.score)}</strong>
            </span>
          </li>
        );
      })}
      <li className="bn-goals-foot">Target {TARGET_SCORE}%</li>
    </ul>
  );
}

/**
 * The contractors that need the next conversation — weakest first, the
 * worst one raised onto the accent so a glance lands on it.
 */
export function Watchlist({
  rows,
  onSelect,
}: {
  rows: BoardRow[];
  onSelect: (row: BoardRow) => void;
}) {
  if (rows.length === 0) return <div className="chart-empty">—</div>;
  return (
    <ul className="bn-watch">
      {rows.map((row, i) => (
        <li key={row.contractorId} className={i === 0 ? "is-lead" : undefined}>
          <button type="button" onClick={() => onSelect(row)}>
            <b>{row.label}</b>
            <em>
              {row.areasBelow}/{row.areasScored} areas below target
            </em>
            <strong>{formatScore(row.score)}</strong>
          </button>
        </li>
      ))}
    </ul>
  );
}
