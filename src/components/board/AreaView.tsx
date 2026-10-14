"use client";

import { bandColor } from "@/lib/ehss/bands";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { ISSUE_BY_CODE } from "@/lib/ehss/issues";
import { quarterLabel } from "@/lib/ehss/model";
import { formatScore } from "@/lib/format";
import type { AreaStanding, EvidenceRow } from "@/lib/ehss/summaries";
import type { ChecklistQuestion } from "@/lib/ehss/model";

/**
 * Drill two — the detail behind one area.
 *
 * This is the level where words belong, because "what was actually found"
 * has no shape. Above here the screens carry magnitude and direction and
 * almost nothing else; here a reader has stopped scanning and started
 * reading, and wants to know what is missing.
 */
export function AreaView({
  area,
  contractorLabel,
  programmeScore,
  questions,
  evidence,
}: {
  area: AreaStanding;
  contractorLabel: string;
  programmeScore: number | null;
  questions: ChecklistQuestion[];
  evidence: EvidenceRow[];
}) {
  const gap = area.score === null ? null : Math.max(0, TARGET_SCORE - area.score);

  return (
    <div className="av">
      <div className="av-hero">
        <span className="av-score" style={{ color: bandColor(area.score) }}>
          {formatScore(area.score)}
        </span>
        <span className="av-gap">
          {gap === null ? "not scored" : `${gap.toFixed(1)} points below the ${TARGET_SCORE}% target`}
        </span>
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

      <dl className="av-facts">
        <div>
          <dt>Contractor</dt>
          <dd>{contractorLabel}</dd>
        </div>
        <div>
          <dt>Previous review</dt>
          <dd>{area.previous === null ? "—" : formatScore(area.previous)}</dd>
        </div>
        <div>
          <dt>Programme</dt>
          <dd>{formatScore(programmeScore)}</dd>
        </div>
        <div>
          <dt>Questions in this area</dt>
          <dd>{questions.length}</dd>
        </div>
      </dl>

      {evidence.length > 0 && (
        <section className="av-block">
          <h4 className="av-h">What the auditor recorded</h4>
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
          {questions.map((q) => (
            <li key={q.code}>
              <span className="av-q-code">
                {q.code}
                <em>w{q.weight}</em>
              </span>
              <span className="av-q-text">{q.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
