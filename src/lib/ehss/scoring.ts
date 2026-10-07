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
  RecordedAreaScores,
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

/** Mean of the scored entries, or null when none is scored. */
const meanOf = (scores: Array<{ score: number | null }>): number | null => {
  const scored = scores.filter((s) => s.score !== null);
  return scored.length === 0
    ? null
    : round2(scored.reduce((sum, s) => sum + s.score!, 0) / scored.length);
};

/**
 * Roll sub-section scores up into sections and a total. Shared by both
 * scoring paths so a historical audit and one entered through the app
 * aggregate identically — only where the sub-section score came from
 * differs.
 */
function aggregate(
  sections: Array<Omit<SectionScore, "score">>,
): AuditScore {
  const scored = sections.map((s) => ({ ...s, score: meanOf(s.subSections) }));
  return { sections: scored, total: meanOf(scored) };
}

export function scoreAudit(
  checklist: readonly ChecklistSection[],
  responses: Record<string, EhssResponse>,
): AuditScore {
  return aggregate(
    checklist.map((section) => ({
      code: section.code,
      title: section.title,
      subSections: section.subSections.map((ss) => ({
        code: ss.code,
        title: ss.title,
        score: scoreQuestions(ss.questions, responses),
      })),
    })),
  );
}

/**
 * Score an audit recorded as AREA points rather than per-question answers —
 * a historical audit imported from a sheet.
 *
 * The area score is the workbook's sub-section rule applied to the points
 * the sheet already holds (points ÷ applicable weight), and from there the
 * aggregation is identical: section = mean of its areas, total = mean of the
 * sections. An area the sheet left out is null and drops out of the mean,
 * exactly as an all-N/A sub-section does.
 *
 * Section A's questions sit directly in the section, so its area is keyed by
 * the section code ("A"); every other area is keyed by its sub-section code.
 */
export function scoreRecordedAreas(
  checklist: readonly ChecklistSection[],
  areas: RecordedAreaScores,
): AuditScore {
  const scoreOf = (key: string): number | null => {
    const area = areas[key];
    if (!area || area.possible <= 0) return null;
    return round2((area.scored / area.possible) * 100);
  };
  return aggregate(
    checklist.map((section) => ({
      code: section.code,
      title: section.title,
      subSections: section.subSections.map((ss) => ({
        code: ss.code,
        title: ss.title,
        score: scoreOf(ss.code ?? section.code),
      })),
    })),
  );
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

/** Answers only — convenience for fixtures where categories don't matter. */
export function toResponses(
  answers: Record<string, EhssAnswer>,
): Record<string, EhssResponse> {
  return Object.fromEntries(
    Object.entries(answers).map(([code, answer]) => [
      code,
      { answer, issues: [] },
    ]),
  );
}
