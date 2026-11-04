/**
 * The answer reducers — the rules that decide what an answer DOES to the
 * causes and the observation recorded beside it.
 *
 * These are the AUDIT'S SEMANTICS, not one screen's behaviour, which is why
 * they live in the domain rather than in the component that happens to call
 * them. They were in `components/audit/QuestionRow.tsx` until 2026-10-18;
 * the project compiles JSX with `jsx: preserve`, so nothing in a `.tsx`
 * file can be imported by a test, and rules this quiet are exactly the ones
 * that need pinning. The move is what made that possible.
 *
 * Every reducer SPREADS THE CURRENT RESPONSE before correcting it. They
 * used to rebuild it as exactly `{ answer, issues }`, which silently
 * deleted any other field — an observation written against a Partial
 * vanished the moment the auditor changed their mind to No, with no error
 * and nothing to see.
 */

import { GAP_CATEGORIES, type IssueCode } from "./issues";
import type { EhssAnswer, EhssResponse } from "./model";

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
  // Spread the current response first. These reducers used to rebuild it as
  // exactly `{ answer, issues }`, which silently deleted anything else on it
  // — a note written against a Partial vanished the moment the auditor
  // changed their mind to No. The explicit fields below still win.
  return {
    ...responses,
    [code]: { ...cur, answer, issues: keep ? cur!.issues : [] },
  };
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
      ...cur,
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
  return { ...responses, [code]: { ...cur, issues: on ? ["GOOD"] : [] } };
}

/**
 * Record what the auditor saw, or clear it.
 *
 * Refuses to attach a note to a question with no answer: an unanswered
 * question has no entry in `responses` at all, and inventing one to hang
 * text off would make it count as answered everywhere that counts answers.
 * Returns the same object when nothing changed, so the store's "did this
 * actually change" check still short-circuits.
 */
export function withNote(
  responses: Responses,
  code: string,
  text: string,
): Responses {
  const cur = responses[code];
  if (!cur) return responses;
  const next = text.trim();
  if ((cur.note ?? "") === next) return responses;
  const response: EhssResponse = { ...cur };
  if (next.length === 0) delete response.note;
  else response.note = next;
  return { ...responses, [code]: response };
}

/** Gaps with no cause recorded — what blocks a checklist from being submitted. */
export function gapsNeedingCause(responses: Responses): number {
  return Object.values(responses).filter(
    (r) => (r.answer === "partial" || r.answer === "no") && r.issues.length === 0,
  ).length;
}
