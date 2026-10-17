/**
 * Actions — what is being done about a finding.
 *
 * The board diagnosed and stopped. It would say RPCO is at 45.8% and
 * nothing else, and every director's next sentence is "and what is being
 * done?" — which the app could not answer anywhere. This is that answer.
 *
 * TWO RULES SHAPE EVERY DECISION HERE.
 *
 * 1. AN OWNER IS A FUNCTION, NEVER A PERSON. `issues.ts` already names the
 *    owner of each of the seven causes — "Contractor EHSS management",
 *    "Planning and engineering", "Site supervision". An action inherits it
 *    from its causes, so there is no assignee field, no name and no email.
 *    That keeps the no-personal-data invariant intact, which is what lets
 *    this system run where it runs (COMPLIANCE-KSA §4) — and it is the
 *    better model anyway, because people move between quarters and roles
 *    do not.
 *
 * 2. CLOSURE IS DERIVED FROM THE NEXT REVIEW, NOT FROM A TICK. An action
 *    closes when a later finalized review scores the thing it was raised
 *    against at or above target. A register that closes on a checkbox rots
 *    into green while the site does not change, which is the failure mode
 *    of every action tracker anyone has ever been made to use. A manual
 *    close exists, because sometimes work genuinely leaves scope — and it
 *    is recorded and displayed as "closed without evidence", a different
 *    thing from closed.
 *
 * There is also no free text. The cause list is the vocabulary, same as the
 * audit itself: a notes field is how an audit tool acquires personal data
 * by accident.
 */

import { TARGET_SCORE } from "./disciplines";
import { ISSUE_BY_CODE, type IssueCode } from "./issues";
import { nextQuarter, type EhssAudit } from "./model";
import { CRITICAL_RISK_BY_ID, type CriticalRiskId } from "./critical-risks";
import { riskScore } from "./scopes";
import { scoreChecklist } from "./summaries";

/** What an action is raised against. */
export type ActionTargetKind = "area" | "risk";

export interface ActionTarget {
  kind: ActionTargetKind;
  /** Checklist area code ("B6") or critical-risk id ("fire"). */
  code: string;
  /** What to print. Stored so a renamed area does not orphan the history. */
  label: string;
}

export interface EhssAction {
  id: string;
  contractorId: string;
  target: ActionTarget;
  /** The quarter whose review raised it. */
  raisedQuarter: string;
  /** The quarter it is expected to be closed by. */
  targetQuarter: string;
  /**
   * Why, from the fixed category list — and therefore WHO owns it. Never
   * typed, and at least one is required: an action with no cause names
   * nobody and asks for nothing.
   */
  causes: IssueCode[];
  /**
   * Set only when someone closed it by hand. Kept apart from derived
   * closure on purpose: the two are different claims and must read
   * differently.
   */
  closedByHand?: { quarter: string; reason: ManualCloseReason };
}

export type ManualCloseReason = "out-of-scope" | "superseded";

export const MANUAL_CLOSE_REASONS: Array<{
  id: ManualCloseReason;
  label: string;
  description: string;
}> = [
  {
    id: "out-of-scope",
    label: "Work left scope",
    description:
      "The contractor no longer does this work, so no future review can score it.",
  },
  {
    id: "superseded",
    label: "Superseded",
    description: "Replaced by another action against the same finding.",
  },
];

export type ActionStatus =
  | "open"
  | "overdue"
  | "closed-by-review"
  | "closed-without-evidence";

export interface ActionState {
  status: ActionStatus;
  /** The review that closed it, when one did. */
  evidence?: { quarter: string; score: number };
  /** Quarters past its target quarter, when it is overdue. */
  overdueBy?: number;
}

/** Everyone who owns a piece of this action, in register order, deduped. */
export function actionOwners(action: EhssAction): string[] {
  const owners = action.causes
    .map((c) => ISSUE_BY_CODE[c]?.owner)
    .filter((o): o is string => Boolean(o) && o !== "—");
  return [...new Set(owners)];
}

/** `2026-Q1` -> a sortable integer, so "later than" is arithmetic. */
function ordinal(quarter: string): number {
  const [year, q] = quarter.split("-");
  return Number(year) * 4 + Number((q ?? "Q1").slice(1));
}

/** What the target scored in one review, or null when that review does not
 * measure it. One place, so an area and a hazard are asked the same way. */
export function targetScoreIn(
  audit: EhssAudit,
  target: ActionTarget,
): number | null {
  if (target.kind === "risk") {
    return riskScore(audit, target.code as CriticalRiskId).score;
  }
  const score = scoreChecklist(audit);
  for (const section of score.sections) {
    for (const ss of section.subSections) {
      if ((ss.code ?? section.code) === target.code) return ss.score;
    }
  }
  return null;
}

/**
 * Where an action stands, computed — never stored.
 *
 * `reviews` is every audit for the contractor; only FINALIZED ones later
 * than the quarter it was raised in can close it. A draft cannot: an
 * unfinished review is not evidence of anything, and closing against one
 * would let a register be cleared by opening a form.
 */
export function actionState(
  action: EhssAction,
  reviews: EhssAudit[],
  currentQuarter: string,
): ActionState {
  const later = reviews
    .filter(
      (a) =>
        a.contractorId === action.contractorId &&
        a.status !== "draft" &&
        ordinal(a.quarter) > ordinal(action.raisedQuarter),
    )
    .sort((a, b) => ordinal(a.quarter) - ordinal(b.quarter));

  for (const review of later) {
    const score = targetScoreIn(review, action.target);
    if (score !== null && score >= TARGET_SCORE) {
      return {
        status: "closed-by-review",
        evidence: { quarter: review.quarter, score },
      };
    }
  }

  if (action.closedByHand) return { status: "closed-without-evidence" };

  const late = ordinal(currentQuarter) - ordinal(action.targetQuarter);
  return late > 0 ? { status: "overdue", overdueBy: late } : { status: "open" };
}

export const isClosed = (state: ActionState) =>
  state.status === "closed-by-review" ||
  state.status === "closed-without-evidence";

export interface ActionTally {
  open: number;
  overdue: number;
  closedByReview: number;
  closedWithoutEvidence: number;
}

export function tallyActions(
  actions: EhssAction[],
  reviews: EhssAudit[],
  currentQuarter: string,
): ActionTally {
  const tally: ActionTally = {
    open: 0,
    overdue: 0,
    closedByReview: 0,
    closedWithoutEvidence: 0,
  };
  for (const action of actions) {
    const state = actionState(action, reviews, currentQuarter);
    if (state.status === "open") tally.open += 1;
    else if (state.status === "overdue") tally.overdue += 1;
    else if (state.status === "closed-by-review") tally.closedByReview += 1;
    else tally.closedWithoutEvidence += 1;
  }
  return tally;
}

/** A hazard's printable name, for an action raised against one. */
export const riskLabel = (id: CriticalRiskId) =>
  CRITICAL_RISK_BY_ID[id]?.label ?? id;

/** The quarter an action raised now should be fixed by: the next one. A
 * quarterly programme cannot verify anything sooner than its next review. */
export const defaultTargetQuarter = (raised: string) => nextQuarter(raised);
