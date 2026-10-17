"use client";

import { useMemo, useState } from "react";
import {
  QuestionRow,
  gapsNeedingCause,
  withAnswer,
  withGoodPractice,
  withIssue,
  withoutAnswer,
  type Responses,
} from "./QuestionRow";
import { answeredCount, scoreAudit } from "@/lib/ehss/scoring";
import { ratingFor, type EhssResponse } from "@/lib/ehss/model";
import { formatScore } from "@/lib/format";
import type { ChecklistScope } from "@/lib/ehss/scopes";

type Filter = "all" | "todo" | "gaps" | "needs";

const FILTERS: Array<{ id: Filter; label: string; title: string }> = [
  { id: "all", label: "All", title: "Every question" },
  { id: "todo", label: "To do", title: "Not yet answered" },
  { id: "gaps", label: "Gaps", title: "Answered Partial or No" },
  { id: "needs", label: "No cause", title: "A gap with no issue category yet" },
];

function matches(filter: Filter, r: EhssResponse | undefined): boolean {
  if (filter === "all") return true;
  if (filter === "todo") return r === undefined;
  if (r === undefined) return false;
  const gap = r.answer === "partial" || r.answer === "no";
  if (filter === "gaps") return gap;
  return gap && r.issues.length === 0;
}

/**
 * Any checklist that is not the Health & Safety one.
 *
 * H&S has its own screen because it alone carries imported AREA POINTS —
 * fifteen areas transcribed from sheets that recorded no per-question
 * answer — and the precedence between those points and the answers is the
 * complicated part of that form. Every other scope has only questions:
 * Environment, Security, Worker Welfare, and each of the fourteen CRC
 * hazards. They get this.
 *
 * Same engine, same answers, same causes, same formula. The only thing that
 * differs between an Environment checklist and a Hot Work one is which
 * questions are in it, which is exactly the property that lets eighteen more
 * checklists arrive without a line of new scoring code.
 */
export function ChecklistForm({
  scope,
  responses,
  canEdit,
  onChange,
}: {
  scope: ChecklistScope;
  responses: Responses;
  canEdit: boolean;
  /** Called on every edit; the parent owns persistence. */
  onChange: (next: Responses) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const score = useMemo(
    () => scoreAudit(scope.sections, responses),
    [scope.sections, responses],
  );
  const progress = useMemo(
    () => answeredCount(scope.sections, responses),
    [scope.sections, responses],
  );
  const needCause = useMemo(() => gapsNeedingCause(responses), [responses]);

  const pct = progress.total === 0 ? 0 : (progress.answered / progress.total) * 100;

  return (
    <div className="cl-form">
      <div className="cl-bar">
        <span className="entry-progress" aria-live="polite">
          <strong>
            {progress.answered}/{progress.total}
          </strong>{" "}
          answered
        </span>
        <span className="entry-track" aria-hidden>
          <i style={{ width: `${pct}%` }} />
        </span>
        <span className="entry-live">
          {formatScore(score.total)}
          <em>{ratingFor(score.total) ?? "unrated"}</em>
        </span>
        {needCause > 0 && (
          <button
            type="button"
            className="entry-warn"
            onClick={() => setFilter("needs")}
          >
            {needCause} need a cause
          </button>
        )}
        <span className="entry-filters" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              title={f.title}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </span>
      </div>

      {scope.sections.map((section) => {
        const visible = section.subSections.filter((ss) =>
          ss.questions.some((q) => matches(filter, responses[q.code])),
        );
        if (visible.length === 0) return null;
        return (
          <div key={section.code}>
            <div className="section-head">
              <span>
                {section.code}. {section.title}
              </span>
              <span className="section-score">
                {formatScore(
                  score.sections.find((s) => s.code === section.code)?.score ??
                    null,
                )}
              </span>
            </div>
            {visible.map((ss) => (
              <div key={ss.code ?? section.code} className="q-area">
                {ss.code && (
                  <div className="q-category">
                    <span>
                      {ss.code} — {ss.title}
                    </span>
                    <span className="section-score">
                      {formatScore(
                        score.sections
                          .find((s) => s.code === section.code)
                          ?.subSections.find((x) => x.code === ss.code)?.score ??
                          null,
                      )}
                    </span>
                  </div>
                )}
                {ss.questions
                  .filter((q) => matches(filter, responses[q.code]))
                  .map((q) => (
                    <QuestionRow
                      key={q.code}
                      question={q}
                      response={responses[q.code]}
                      canEdit={canEdit}
                      onAnswer={(a) => onChange(withAnswer(responses, q.code, a))}
                      onClear={() => onChange(withoutAnswer(responses, q.code))}
                      onToggleIssue={(i) =>
                        onChange(withIssue(responses, q.code, i))
                      }
                      onGoodPractice={(on) =>
                        onChange(withGoodPractice(responses, q.code, on))
                      }
                    />
                  ))}
              </div>
            ))}
          </div>
        );
      })}

      {progress.answered === progress.total && filter === "todo" && (
        <div className="entry-empty">
          Every question is answered.{" "}
          <button type="button" onClick={() => setFilter("all")}>
            Show all
          </button>
        </div>
      )}
      {needCause === 0 && filter === "needs" && (
        <div className="entry-empty">
          Every gap has a cause recorded.{" "}
          <button type="button" onClick={() => setFilter("all")}>
            Show all
          </button>
        </div>
      )}
    </div>
  );
}
