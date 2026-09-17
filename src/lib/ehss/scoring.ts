/**
 * EHSS scoring — the workbook's formula, reimplemented:
 *
 *   points(question)      = weight × (Full = 1, Partial = 0.5, No = 0)
 *   N/A                   = excluded from numerator and denominator
 *   sub-section score     = Σ points / Σ weight of applicable questions
 *   section score         = mean of its sub-section scores
 *                           (a section without sub-sections scores directly)
 *   TOTAL                 = mean of the section scores
 *
 * All scores are percentages rounded to 2 decimals; a scope with no
 * applicable answered questions scores null ("N/A"), never 0.
 *
 * Note: the source workbook adds a manual +0.012 to its total
 * (`=AVERAGE(...)+0.012`). That adjustment is NOT reproduced here.
 */

import type {
  ChecklistQuestion,
  ChecklistSection,
  EhssAnswer,
  EhssResponse,
} from "./model";
import { ANSWER_VALUE } from "./model";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Weighted ratio in percent over the answered, applicable questions. */
export function scoreQuestions(
  questions: readonly ChecklistQuestion[],
  responses: Record<string, EhssResponse>,
): number | null {
  let points = 0;
  let possible = 0;
  for (const q of questions) {
    const r = responses[q.code];
    if (!r || r.answer === "na") continue;
    points += q.weight * ANSWER_VALUE[r.answer];
    possible += q.weight;
  }
  if (possible === 0) return null;
  return round2((points / possible) * 100);
}

export interface SubSectionScore {
  code: string | null;
  title: string | null;
  score: number | null;
}

export interface SectionScore {
  code: string;
  title: string;
  score: number | null;
  subSections: SubSectionScore[];
}

export interface AuditScore {
  sections: SectionScore[];
  total: number | null;
}

export function scoreAudit(
  checklist: readonly ChecklistSection[],
  responses: Record<string, EhssResponse>,
): AuditScore {
  const sections = checklist.map((section) => {
    const subSections = section.subSections.map((ss) => ({
      code: ss.code,
      title: ss.title,
      score: scoreQuestions(ss.questions, responses),
    }));
    const scored = subSections.filter((s) => s.score !== null);
    const score =
      scored.length === 0
        ? null
        : round2(scored.reduce((sum, s) => sum + s.score!, 0) / scored.length);
    return { code: section.code, title: section.title, score, subSections };
  });

  const scoredSections = sections.filter((s) => s.score !== null);
  const total =
    scoredSections.length === 0
      ? null
      : round2(
          scoredSections.reduce((sum, s) => sum + s.score!, 0) /
            scoredSections.length,
        );

  return { sections, total };
}

/** How many questions have an answer, out of the checklist's total. */
export function answeredCount(
  checklist: readonly ChecklistSection[],
  responses: Record<string, EhssResponse>,
): { answered: number; total: number } {
  let answered = 0;
  let total = 0;
  for (const section of checklist) {
    for (const ss of section.subSections) {
      for (const q of ss.questions) {
        total += 1;
        if (responses[q.code]) answered += 1;
      }
    }
  }
  return { answered, total };
}

/** Flat list of every question with its section/sub-section context. */
export function flattenChecklist(checklist: readonly ChecklistSection[]) {
  return checklist.flatMap((section) =>
    section.subSections.flatMap((ss) =>
      ss.questions.map((q) => ({
        section: section.code,
        sectionTitle: section.title,
        subSection: ss.code,
        subSectionTitle: ss.title,
        question: q,
      })),
    ),
  );
}

/** Answers only — convenience for fixtures where observations don't matter. */
export function toResponses(
  answers: Record<string, EhssAnswer>,
): Record<string, EhssResponse> {
  return Object.fromEntries(
    Object.entries(answers).map(([code, answer]) => [
      code,
      { answer, observation: null },
    ]),
  );
}
