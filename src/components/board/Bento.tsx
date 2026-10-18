"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { bandColor, bandFor } from "@/lib/ehss/bands";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { formatScore } from "@/lib/format";
import { quarterLabel } from "@/lib/ehss/model";
import { TargetBar } from "@/components/charts/Marks";
import type {
  AuditSummary,
  BoardPanel,
  BoardRow,
  ProgrammeKpis,
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
  className,
  children,
}: {
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`bn-card${className ? ` ${className}` : ""}`}>
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
 * THE ONE THING THE BOARD SAYS.
 *
 * A bento of ten equal tiles has no subject: a reader who has never seen this
 * screen has nowhere to land, and the board used to print its headline figure
 * three times at three sizes (a header pill, a tile hero, a row inside
 * "Against target") while never stating the fact those figures add up to.
 * This tile is that fact, in four parts and no sentence:
 *
 *   the figure · how far it is from target · how the contractors are spread
 *   across the scorecard's own bands
 *
 * The gap meter is the same `TargetBar` every score in the app is drawn with,
 * so its length means the same thing here as in the watchlist. The band row
 * shows EVERY band including the empty ones, because a zero in the top band
 * is the finding — it reads correctly beside the bands that are populated,
 * which is not true of a lone "0" on a tile of its own.
 */
export function HeroTile({
  kpi,
  quarter,
  basis,
}: {
  kpi: ProgrammeKpis;
  quarter: string | null;
  /** What the average is an average OF, when that needs saying. */
  basis?: ReactNode;
}) {
  return (
    <section className="bn-card bn-hero">
      <header className="bn-card-head">
        <div>
          <h2>Programme average</h2>
          <p>
            {quarter ? quarterLabel(quarter) : "no quarter on record"}
            {kpi.contractors > 0 && ` · ${kpi.contractors} contractors`}
          </p>
        </div>
        {basis}
      </header>

      <div className="bn-hero-fig">
        <strong>{formatScore(kpi.average)}</strong>
        <Delta value={kpi.delta} />
      </div>

      <div className="bn-hero-meter">
        <TargetBar score={kpi.average} label="Programme average" lead />
        <span className="bn-hero-gap">
          {kpi.gap === null ? (
            "not scored"
          ) : kpi.gap === 0 ? (
            `at the ${TARGET_SCORE}% target`
          ) : (
            <>
              <b>{kpi.gap.toFixed(1)}</b> under the {TARGET_SCORE}% target
            </>
          )}
        </span>
      </div>

      <ul className="bn-bands">
        {kpi.bands.map((b) => (
          <li
            key={b.id}
            className={b.count === 0 ? "is-zero" : undefined}
            title={`${b.count} ${b.label}`}
          >
            <i style={{ background: `var(--band-${b.id})` }} aria-hidden />
            <strong>{b.count}</strong>
            <em>{b.short}</em>
          </li>
        ))}
      </ul>
    </section>
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
  mark,
  tone,
  delta,
  className,
  action,
}: {
  label: string;
  value: ReactNode;
  note: ReactNode;
  /** The figure as a shape. A tile with a number and no mark is a sentence
   * with a digit in it; seven of the board's ten tiles used to be exactly
   * that. Omitted only where the quantity has no shape to draw. */
  mark?: ReactNode;
  tone?: string;
  delta?: number | null;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`bn-card bn-stat${className ? ` ${className}` : ""}`}>
      <header className="bn-card-head">
        <h2>{label}</h2>
        {action}
        {delta !== undefined && <Delta value={delta} />}
      </header>
      <strong className="bn-stat-value" style={tone ? { color: tone } : undefined}>
        {value}
      </strong>
      {mark}
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
              {/* The leftmost column used to hold a square of the
                  contractor's initials — decoration in the one place a row
                  has room for a mark. It carries the score instead. */}
              <span className="bn-feed-id">
                <b>
                  {r.contractorName} ({r.contractorCode})
                </b>
                <em>
                  {r.subRegionName} · {quarterLabel(r.quarter)}
                </em>
                <TargetBar score={r.overall} label={r.contractorName} />
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
 * Each sub-region against the 90% target.
 *
 * These are `TargetBar`s on the full 0-100 track, like every other score in
 * the app. They used to be drawn as a fraction of the target instead
 * (`score / 90`), which made the same 62.4 a different length here than in
 * the tile beside it — two scales on one screen, and a reader comparing
 * lengths across them is comparing nothing.
 *
 * The programme row appears only when it is a REFERENCE rather than a repeat:
 * with a sub-region selected, a director needs the whole against which to
 * read their own patch, and without one the hero tile is already that figure.
 */
export function TargetGoals({
  panels,
  programme,
}: {
  panels: BoardPanel[];
  /** The whole programme, or null when the hero already prints it. */
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
    ...(programme === null
      ? []
      : [
          {
            id: "programme",
            name: "Programme",
            note: `${panels.reduce((n, p) => n + p.rows.length, 0)} contractors`,
            score: programme,
            lead: true,
          },
        ]),
  ];
  return (
    <ul className="bn-goals">
      {rows.map((p) => (
        <li key={p.id} className={p.lead ? "is-lead" : undefined}>
          <TargetBar score={p.score} label={p.name} />
          <span className="bn-goal-foot">
            <b>{p.name}</b>
            <em>{p.note}</em>
            <span className="spacer" />
            <strong>{formatScore(p.score)}</strong>
          </span>
        </li>
      ))}
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
              {row.areasBelow}/{row.areasScored} areas
            </em>
            <strong>{formatScore(row.score)}</strong>
            <TargetBar score={row.score} label={row.label} onAccent={i === 0} />
          </button>
        </li>
      ))}
    </ul>
  );
}
