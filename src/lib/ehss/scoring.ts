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
 *
 * Two entry points feed the one aggregation, because an area can be on
 * record at either grain: `scoreAudit` from per-question answers and
 * `scoreRecordedAreas` from the area points a historical sheet holds.
 * `scoreAreasAndAnswers` is the two together, choosing a source per area —
 * which source, and why it is decided per area rather than per audit, is
 * documented on that function.
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
  return aggregate(
    checklist.map((section) => ({
      code: section.code,
      title: section.title,
      subSections: section.subSections.map((ss) => ({
        code: ss.code,
        title: ss.title,
        score: recordedAreaScore(areas, ss.code ?? section.code),
      })),
    })),
  );
}

/** One area's recorded points as a percentage — the sub-section rule applied
 * to points a sheet already holds. Null when the area was not recorded. */
function recordedAreaScore(
  areas: RecordedAreaScores,
  key: string,
): number | null {
  const area = areas[key];
  if (!area || area.possible <= 0) return null;
  return round2((area.scored / area.possible) * 100);
}

/**
 * Score an audit that holds BOTH recorded area points and checklist answers
 * — which is what an imported review becomes the moment someone re-audits
 * part of it in the app.
 *
 * The formula is untouched: every area is still points ÷ applicable weight,
 * every section still the mean of its areas, the total still the mean of the
 * sections. What this adds is the choice of SOURCE, made per area rather
 * than per audit:
 *
 *   an area whose questions are ALL answered scores from those answers;
 *   any other area scores from its recorded points, if it has any;
 *   an area with neither scores null and drops out of the mean.
 *
 * Per area, because per audit is destructive. The precedence used to be
 * "answers win if the audit has any", so answering one question on an
 * imported review silently dropped the other fourteen areas of real recorded
 * points out of the score. And the opposite ordering is just as wrong: an
 * auditor who works through an area and watches its figure refuse to move is
 * being shown last quarter's number as if it were this one.
 *
 * ALL answered, not SOME, for the same reason: a recorded area is a complete
 * figure, and replacing it with three answers out of eight reports a part of
 * the area as if it were the whole. An area with no recorded points has no
 * complete figure to protect, so it scores from whatever is answered — which
 * is what gives a new draft its live score.
 */
export function scoreAreasAndAnswers(
  checklist: readonly ChecklistSection[],
  areas: RecordedAreaScores,
  responses: Record<string, EhssResponse>,
): AuditScore {
  return aggregate(
    checklist.map((section) => ({
      code: section.code,
      title: section.title,
      subSections: section.subSections.map((ss) => ({
        code: ss.code,
        title: ss.title,
        score: areaSource(ss.questions, areas, ss.code ?? section.code, responses)
          .score,
      })),
    })),
  );
}

/** Which of the two sources scores an area, and the figure it gives.
 * Exported because the entry screen has to SAY which one it is using: a
 * score that changes source without telling anyone is the bug this replaces. */
export function areaSource(
  questions: readonly ChecklistQuestion[],
  areas: RecordedAreaScores,
  key: string,
  responses: Record<string, EhssResponse>,
): { source: "answers" | "points" | "none"; score: number | null } {
  const recorded = recordedAreaScore(areas, key);
  const complete =
    questions.length > 0 && questions.every((q) => responses[q.code] !== undefined);
  if (recorded !== null && !complete) return { source: "points", score: recorded };
  const fromAnswers = scoreQuestions(questions, responses);
  return fromAnswers === null
    ? { source: "none", score: null }
    : { source: "answers", score: fromAnswers };
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
