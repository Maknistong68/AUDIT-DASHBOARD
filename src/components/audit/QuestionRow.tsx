"use client";

import {
  ANSWER_LABELS,
  type ChecklistQuestion,
  type EhssAnswer,
  type EhssResponse,
} from "@/lib/ehss/model";
import {
  GAP_CATEGORIES,
  ISSUE_BY_CODE,
  type IssueCode,
} from "@/lib/ehss/issues";
import { NoteField } from "./NoteField";

export const ANSWERS: EhssAnswer[] = ["full", "partial", "no", "na"];

/**
 * One checklist question: the ask, the four-way answer, and — on a gap —
 * the cause picker.
 *
 * Shared on purpose. There is one Health & Safety checklist today and there
 * will be eighteen more (Environment, Security, Worker Welfare, and one per
 * CRC hazard — see lib/ehss/scopes). They all ask the same kind of question
 * and must all record the same kind of answer, so the row an auditor
 * actually touches is written once. A second copy of this markup is how two
 * checklists end up disagreeing about what "Partial" means.
 *
 * The answer is one of four and the reason is picked from the fixed category
 * list — neither is ever typed. Beneath them sits the audit's ONE free-text
 * field, "what was seen", which is optional, capped and refused outright if
 * it looks like it names somebody (`noteProblem`, lib/ehss/model.ts). It
 * exists because the categories say why a requirement was missed and the
 * score says how much, and neither can say what was actually on site.
 * Read docs/COMPLIANCE-KSA.md §2 and §4 before widening it.
 */
export function QuestionRow({
  question,
  response,
  canEdit,
  onAnswer,
  onClear,
  onToggleIssue,
  onGoodPractice,
  onNote,
}: {
  question: ChecklistQuestion;
  response: EhssResponse | undefined;
  canEdit: boolean;
  onAnswer: (answer: EhssAnswer) => void;
  onClear: () => void;
  onToggleIssue: (issue: IssueCode) => void;
  onGoodPractice: (on: boolean) => void;
  onNote: (text: string) => void;
}) {
  const r = response;
  const isGap = r !== undefined && (r.answer === "partial" || r.answer === "no");

  return (
    <div className="q-item">
      <div>
        <span className="code">{question.code}</span>
        <span className="q-text">{question.text}</span>{" "}
        <span className="q-weight">w{question.weight}</span>
      </div>
      <div
        className="result-toggle"
        role="group"
        aria-label={`Answer for ${question.code}`}
      >
        {ANSWERS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={r?.answer === a}
            disabled={!canEdit}
            onClick={() => onAnswer(a)}
          >
            {ANSWER_LABELS[a]}
          </button>
        ))}
        {canEdit && r && (
          <button
            type="button"
            className="q-clear"
            title={`Clear the answer to ${question.code}`}
            onClick={onClear}
          >
            Clear
          </button>
        )}
      </div>

      {r && r.answer !== "na" && (
        <div className="q-detail">
          {isGap ? (
            <>
              <span className="q-detail-label">
                Why? <em>pick every cause that applies</em>
                {r.issues.length === 0 && (
                  <strong className="q-required">required</strong>
                )}
              </span>
              <div
                className="issue-picker"
                role="group"
                aria-label={`Issue categories for ${question.code}`}
              >
                {GAP_CATEGORIES.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    aria-pressed={r.issues.includes(c.code)}
                    disabled={!canEdit}
                    title={`${c.description} — ${c.owner}`}
                    onClick={() => onToggleIssue(c.code)}
                  >
                    <b>{c.code}</b> {c.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={r.issues.includes("GOOD")}
                disabled={!canEdit}
                onChange={(e) => onGoodPractice(e.target.checked)}
              />
              {ISSUE_BY_CODE.GOOD.label} — beyond the minimum
            </label>
          )}
        </div>
      )}

      {/* Only where there is something to describe. A Full answer with
          nothing wrong does not need a sentence, and 81 textareas on one
          screen is how a form stops being filled in. */}
      {r && r.answer !== "na" && (
        <NoteField
          id={question.code}
          value={r.note}
          canEdit={canEdit}
          onCommit={onNote}
        />
      )}
    </div>
  );
}
