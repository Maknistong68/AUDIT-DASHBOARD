/**
 * Checklist SCOPES — every separately-audited thing that has, or will have,
 * its own checklist.
 *
 * The programme is not one audit with five scores on it. It is five audits,
 * one per scorecard discipline, and the Critical Risk one is itself a focus
 * inspection made of FOURTEEN separate hazard checklists (owner, 2026-10-17).
 * So the unit the app has to model is not "the discipline" and not "the
 * question" but the checklist in between:
 *
 *   hs              Health & Safety — 81 questions, sections A/B/C   (exists)
 *   env  sec  ww    Environment, Security, Worker Welfare            (awaited)
 *   crc:<hazard>    one per hazard in the CRC register, 14 of them   (awaited)
 *
 * Nineteen scopes, one of which currently has content. Everything above a
 * scope — how a discipline rolls up, how the scorecard weights it — is
 * already written and does not change when a checklist arrives; everything
 * below it is the same question/answer/cause machinery H&S already uses.
 * Adding Environment should be adding its sections to this file and nothing
 * else.
 *
 * WHAT THIS FILE DOES NOT DO: invent questions. A scope with no checklist
 * has `sections: []`, and the discipline or hazard it scores carries a
 * recorded number until someone supplies the real thing. A checklist nobody
 * wrote is worse than a blank one, because a blank one is obviously blank.
 */

import { CHECKLIST } from "./checklist";
import { CRITICAL_RISKS, type CriticalRiskId } from "./critical-risks";
import { DISCIPLINES, type DisciplineId } from "./disciplines";
import { answeredCount, scoreAudit } from "./scoring";
import type { ChecklistSection, EhssResponse } from "./model";

/** `"hs"`, `"env"`, `"sec"`, `"ww"`, or `"crc:ground"` and its thirteen peers. */
export type ScopeId = string;

export interface ChecklistScope {
  id: ScopeId;
  /** What an auditor is told they are filling in. */
  label: string;
  /** Which of the five scorecard disciplines this scope feeds. */
  discipline: DisciplineId;
  /** Set only on a CRC scope: which hazard's checklist this is. */
  risk?: CriticalRiskId;
  /** The checklist itself — empty until its content is supplied. */
  sections: readonly ChecklistSection[];
}

const countQuestions = (sections: readonly ChecklistSection[]) =>
  sections.reduce(
    (n, s) => n + s.subSections.reduce((m, ss) => m + ss.questions.length, 0),
    0,
  );

/** The id of the hazard scope for a CRC hazard. */
export const riskScopeId = (risk: CriticalRiskId): ScopeId => `crc:${risk}`;

/**
 * Every scope, in the order an auditor would work through them: the four
 * single-checklist disciplines first, then the fourteen CRC hazards.
 */
export const SCOPES: ChecklistScope[] = [
  { id: "hs", label: "Health & Safety", discipline: "hs", sections: CHECKLIST },
  { id: "env", label: "Environment", discipline: "env", sections: [] },
  { id: "sec", label: "Security", discipline: "sec", sections: [] },
  { id: "ww", label: "Worker Welfare", discipline: "ww", sections: [] },
  ...CRITICAL_RISKS.map((risk) => ({
    id: riskScopeId(risk.id),
    label: risk.label,
    discipline: "crc" as DisciplineId,
    risk: risk.id,
    sections: [] as readonly ChecklistSection[],
  })),
];

export const SCOPE_BY_ID: Record<ScopeId, ChecklistScope> = Object.fromEntries(
  SCOPES.map((s) => [s.id, s]),
);

/** The scopes that feed one discipline: one for four of them, fourteen for CRC. */
export function scopesFor(discipline: DisciplineId): ChecklistScope[] {
  return SCOPES.filter((s) => s.discipline === discipline);
}

/** How many questions a scope asks. 0 means its checklist is not written yet. */
export function questionCount(scope: ChecklistScope): number {
  return countQuestions(scope.sections);
}

/** Does this scope have a checklist to fill in at all? */
export function hasChecklist(scope: ChecklistScope): boolean {
  return questionCount(scope) > 0;
}

/**
 * The answers for one scope.
 *
 * Health & Safety keeps `audit.responses` — it is the field every existing
 * view, the recurrence machinery and the saved records already use, and
 * moving it would orphan every browser's stored edits for no gain. Every
 * other scope lives in `audit.scopedResponses` under its own id.
 */
export function responsesForScope(
  audit: {
    responses: Record<string, EhssResponse>;
    scopedResponses?: Record<ScopeId, Record<string, EhssResponse>>;
  },
  scopeId: ScopeId,
): Record<string, EhssResponse> {
  return scopeId === "hs"
    ? audit.responses
    : (audit.scopedResponses?.[scopeId] ?? {});
}

/** Programme-wide tally, for the reference page and the tests. */
export function scopeCoverage(): {
  total: number;
  withChecklist: number;
  questions: number;
  byDiscipline: Array<{
    discipline: DisciplineId;
    name: string;
    scopes: number;
    withChecklist: number;
    questions: number;
  }>;
} {
  const byDiscipline = DISCIPLINES.map((d) => {
    const scopes = scopesFor(d.id);
    return {
      discipline: d.id,
      name: d.name,
      scopes: scopes.length,
      withChecklist: scopes.filter(hasChecklist).length,
      questions: scopes.reduce((n, s) => n + questionCount(s), 0),
    };
  });
  return {
    total: SCOPES.length,
    withChecklist: SCOPES.filter(hasChecklist).length,
    questions: SCOPES.reduce((n, s) => n + questionCount(s), 0),
    byDiscipline,
  };
}

/**
 * How far through a scope's checklist a review is, and what it scores.
 *
 * `complete` is the gate the precedence rules use everywhere in this app: a
 * checklist takes over from a recorded number only once ALL of its questions
 * are answered. Part of a checklist is not a figure for the checklist, and
 * showing one would replace a complete recorded score with an incomplete
 * computed one — the same rule, and the same reason, as the per-area
 * precedence inside the Health & Safety form.
 */
export interface ScopeProgress {
  scopeId: ScopeId;
  answered: number;
  total: number;
  complete: boolean;
  /** From this scope's own answers; null when nothing applicable is answered. */
  score: number | null;
}

export function scopeProgress(
  audit: {
    responses: Record<string, EhssResponse>;
    scopedResponses?: Record<ScopeId, Record<string, EhssResponse>>;
  },
  scopeId: ScopeId,
): ScopeProgress {
  const scope = SCOPE_BY_ID[scopeId];
  if (!scope) {
    return { scopeId, answered: 0, total: 0, complete: false, score: null };
  }
  const responses = responsesForScope(audit, scopeId);
  const { answered, total } = answeredCount(scope.sections, responses);
  return {
    scopeId,
    answered,
    total,
    complete: total > 0 && answered === total,
    score: total === 0 ? null : scoreAudit(scope.sections, responses).total,
  };
}

/**
 * One CRC hazard's score and where it came from.
 *
 * The register's number is the in-scope flag as well as the value, so a
 * hazard the contractor does not do is absent rather than zero. Its own
 * checklist supersedes that number once complete — which is how the focus
 * inspection stops being fourteen typed figures and becomes fourteen
 * audits.
 */
export function riskScore(
  audit: {
    responses: Record<string, EhssResponse>;
    scopedResponses?: Record<ScopeId, Record<string, EhssResponse>>;
    criticalRisks: Partial<Record<CriticalRiskId, number>>;
  },
  risk: CriticalRiskId,
): { score: number | null; source: "checklist" | "recorded" | "none" } {
  const progress = scopeProgress(audit, riskScopeId(risk));
  if (progress.complete && progress.score !== null) {
    return { score: progress.score, source: "checklist" };
  }
  const recorded = audit.criticalRisks[risk];
  return recorded === undefined
    ? { score: null, source: "none" }
    : { score: recorded, source: "recorded" };
}
