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
 * No free text anywhere: the answer is one of four and the reason is picked
 * from the fixed category list. A comments box is how an audit tool acquires
 * personal data by accident.
 */
export function QuestionRow({
  question,
  response,
  canEdit,
  onAnswer,
  onClear,
  onToggleIssue,
  onGoodPractice,
}: {
  question: ChecklistQuestion;
  response: EhssResponse | undefined;
  canEdit: boolean;
  onAnswer: (answer: EhssAnswer) => void;
  onClear: () => void;
  onToggleIssue: (issue: IssueCode) => void;
  onGoodPractice: (on: boolean) => void;
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
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The answer reducers — the rules that decide what an answer DOES to the
 * causes recorded beside it. Shared for the same reason the row is: these
 * are the audit's semantics, not one screen's behaviour.
 * ------------------------------------------------------------------ */

export type Responses = Record<string, EhssResponse>;

/** Set an answer, keeping the causes only where they still mean something. */
export function withAnswer(
  responses: Responses,
  code: string,
  answer: EhssAnswer,
): Responses {
  const cur = responses[code];
  // Moving between Partial and No keeps the categories — the cause did not
  // change, only how badly. Anything else clears them, because a category
  // chosen for a gap is meaningless on a Full or N/A.
  const keep =
    (answer === "partial" || answer === "no") &&
    cur !== undefined &&
    (cur.answer === "partial" || cur.answer === "no");
  return { ...responses, [code]: { answer, issues: keep ? cur!.issues : [] } };
}

/** Take an answer back off a question — the only way to undo a misclick. */
export function withoutAnswer(responses: Responses, code: string): Responses {
  const next = { ...responses };
  delete next[code];
  return next;
}

/** Toggle one cause, keeping the list in register order so two auditors who
 * pick the same categories produce the same record. */
export function withIssue(
  responses: Responses,
  code: string,
  issue: IssueCode,
): Responses {
  const cur = responses[code];
  if (!cur) return responses;
  const has = cur.issues.includes(issue);
  return {
    ...responses,
    [code]: {
      answer: cur.answer,
      issues: GAP_CATEGORIES.map((c) => c.code).filter((c) =>
        has
          ? cur.issues.includes(c) && c !== issue
          : cur.issues.includes(c) || c === issue,
      ),
    },
  };
}

/** Mark a Full answer as good practice, or take the mark off. */
export function withGoodPractice(
  responses: Responses,
  code: string,
  on: boolean,
): Responses {
  const cur = responses[code];
  if (!cur) return responses;
  return { ...responses, [code]: { answer: cur.answer, issues: on ? ["GOOD"] : [] } };
}

/** Gaps with no cause recorded — what blocks a checklist from being submitted. */
export function gapsNeedingCause(responses: Responses): number {
  return Object.values(responses).filter(
    (r) => (r.answer === "partial" || r.answer === "no") && r.issues.length === 0,
  ).length;
}
