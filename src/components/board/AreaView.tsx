"use client";

import { bandColor } from "@/lib/ehss/bands";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { ISSUE_BY_CODE } from "@/lib/ehss/issues";
import { quarterLabel } from "@/lib/ehss/model";
import { formatScore } from "@/lib/format";
import { TargetBar } from "@/components/charts/Marks";
import type {
  AreaPoints,
  AreaRank,
  AreaStanding,
  EvidenceRow,
} from "@/lib/ehss/summaries";
import type { ChecklistQuestion } from "@/lib/ehss/model";

/**
 * Drill two — the detail behind one area.
 *
 * This is the level where words belong, because "what was actually found"
 * has no shape. Above here the screens carry magnitude and direction and
 * almost nothing else; here a reader has stopped scanning and started
 * reading, and wants to know what is missing.
 *
 * It used to show a percentage, a programme figure beside it as a bare
 * number, and nine questions with no indication which of them cost
 * anything. A director looking at "Subcontractor Management 18.2%" had
 * nothing to say to the contractor. Three things changed that, and all of
 * them are facts the data already held:
 *
 *   the POINTS behind the percentage, and how many were not applicable;
 *   WHERE that sits — against the programme, and among the other
 *     contractors audited in the same quarter;
 *   WHAT THE AUDITOR SAW, which until 2026-10-18 there was nowhere to type.
 *
 * The questions are ordered by what they are WORTH, so the list reads as an
 * agenda rather than as a numbering.
 */
/** 1 -> "", 2 -> "2nd", 3 -> "3rd" … Only used for a rank, so small. */
function ordinal(n: number): string {
  const tail = n % 100 >= 11 && n % 100 <= 13
    ? "th"
    : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${tail}`;
}

export function AreaView({
  area,
  contractorLabel,
  programmeScore,
  points,
  rank,
  note,
  questions,
  evidence,
  actionSlot,
}: {
  area: AreaStanding;
  contractorLabel: string;
  programmeScore: number | null;
  /** The points behind the percentage, where the audit records them. */
  points: AreaPoints | null;
  /** Where this contractor sits among the quarter's audited contractors. */
  rank: AreaRank | null;
  /** What the auditor wrote about the area as a whole. */
  note?: string;
  questions: ChecklistQuestion[];
  evidence: EvidenceRow[];
  /**
   * The actions against this area, and the control to raise one.
   *
   * Passed in rather than built here: this view is a read of the audit and
   * knows nothing about the register, and the day the register moves to a
   * database that should stay true.
   */
  actionSlot?: React.ReactNode;
}) {
  const gap = area.score === null ? null : Math.max(0, TARGET_SCORE - area.score);
  // Worth first. B6.1 alone carries 3 of the area's 15 points and sat in the
  // middle of the list under a "w3" tag nobody reads as "this is where the
  // score is". Ties keep the checklist's own order so the list is stable.
  const byWeight = [...questions].sort((a, b) => b.weight - a.weight);
  const heaviest = byWeight[0]?.weight ?? 1;

  return (
    <div className="av">
      {actionSlot}
      <div className="av-hero">
        <span className="av-score" style={{ color: bandColor(area.score) }}>
          {formatScore(area.score)}
        </span>
        <span className="av-gap">
          {gap === null ? "not scored" : `${gap.toFixed(1)} points below the ${TARGET_SCORE}% target`}
        </span>
        {points && points.source !== "none" && (
          <span className="av-points">
            <b>
              {points.scored} of {points.possible} points
            </b>
            {points.notApplicable > 0 && (
              <>
                {" · "}
                {points.notApplicable} of the area&rsquo;s {points.nominal} not
                applicable here
              </>
            )}
          </span>
        )}
        <span className="av-state">
          {area.previous === null
            ? "First review on record"
            : area.recurring
              ? "Weak in this review and the one before it"
              : area.isNew
                ? "Weak in this review, not the one before"
                : "At or above target"}
        </span>
      </div>

      {/* Two bars on ONE scale, because "18.2" and "27.2" side by side as
          numbers say nothing about whether this is the contractor's problem
          or the programme's. It is the programme's, and the two bars say so
          in the time it takes to look. */}
      <div className="av-compare">
        <div className="av-cmp-row">
          <span className="av-cmp-id">{contractorLabel}</span>
          <TargetBar score={area.score} label={contractorLabel} />
          <strong>{formatScore(area.score)}</strong>
        </div>
        <div className="av-cmp-row is-ref">
          <span className="av-cmp-id">Programme</span>
          <TargetBar score={programmeScore} label="Programme" />
          <strong>{formatScore(programmeScore)}</strong>
        </div>
        {rank && (
          <p className="av-rank">
            <b>
              {rank.rank === 1
                ? "lowest"
                : `${ordinal(rank.rank)} lowest`}{" "}
              of {rank.of}
            </b>{" "}
            audited this quarter ·{" "}
            {rank.atTarget === 0
              ? "none at target"
              : `${rank.atTarget} at target`}
          </p>
        )}
      </div>

      <dl className="av-facts">
        <div>
          <dt>Previous review</dt>
          <dd>{area.previous === null ? "—" : formatScore(area.previous)}</dd>
        </div>
        <div>
          <dt>Questions in this area</dt>
          <dd>{questions.length}</dd>
        </div>
        <div>
          <dt>Points at stake</dt>
          <dd>{points ? points.nominal : "—"}</dd>
        </div>
      </dl>

      {(note || evidence.length > 0) && (
        <section className="av-block">
          <h4 className="av-h">What the auditor recorded</h4>
          {note && <p className="av-note">{note}</p>}
          <ul className="av-evidence">
            {evidence.map((e, i) => (
              <li key={`${e.quarter}-${e.code}-${i}`}>
                <span className="av-ev-head">
                  <strong>{e.code}</strong>
                  <em>{quarterLabel(e.quarter)}</em>
                  {e.answer && (
                    <span className={`av-ans is-${e.answer}`}>
                      {e.answer === "no" ? "No" : "Partial"}
                    </span>
                  )}
                </span>
                <p>{e.text}</p>
                {e.note && <p className="av-note is-q">{e.note}</p>}
                {e.issues.length > 0 && (
                  <span className="av-causes">
                    {e.issues.map((c) => (
                      <i key={c} title={ISSUE_BY_CODE[c].description}>
                        {ISSUE_BY_CODE[c].label}
                      </i>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="av-block">
        <h4 className="av-h">What this area asks</h4>
        <ul className="av-questions">
          {byWeight.map((q) => (
            <li key={q.code}>
              <span className="av-q-code">
                {q.code}
                <em>{q.weight} pts</em>
              </span>
              <span className="av-q-text">{q.text}</span>
              <span className="av-q-weight" aria-hidden>
                <i style={{ width: `${(q.weight / heaviest) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
