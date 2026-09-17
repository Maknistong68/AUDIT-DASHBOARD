/**
 * The five EHSS disciplines and their weights, from the Oxagon master
 * scorecard. The overall contractor score for a quarter is the weighted
 * average of the discipline scores:
 *
 *   Average = 0.40×H&S + 0.25×Critical Risk + 0.10×Environment
 *           + 0.10×Security + 0.15×Worker Welfare
 *
 * (Verified against the source scorecard: every readable row reproduces to
 * one decimal.)
 *
 * Health & Safety is the discipline the 81-question checklist scores in
 * detail; the others carry a recorded score until their own checklists are
 * added.
 */

export type DisciplineId = "hs" | "crc" | "env" | "sec" | "ww";

export interface Discipline {
  id: DisciplineId;
  name: string;
  shortName: string;
  weight: number; // fraction of the overall score
  /** True when a full checklist drives this discipline's score. */
  detailed: boolean;
}

export const DISCIPLINES: Discipline[] = [
  { id: "hs", name: "Health & Safety", shortName: "H&S", weight: 0.4, detailed: true },
  { id: "crc", name: "Critical Risk Control", shortName: "Critical Risk", weight: 0.25, detailed: false },
  { id: "env", name: "Environment", shortName: "Environment", weight: 0.1, detailed: false },
  { id: "sec", name: "Security", shortName: "Security", weight: 0.1, detailed: false },
  { id: "ww", name: "Worker Welfare", shortName: "Worker Welfare", weight: 0.15, detailed: false },
];

export const DISCIPLINE_BY_ID: Record<DisciplineId, Discipline> =
  Object.fromEntries(DISCIPLINES.map((d) => [d.id, d])) as Record<
    DisciplineId,
    Discipline
  >;

export type DisciplineScores = Partial<Record<DisciplineId, number>>;

/** The score a compliant contractor is expected to reach. */
export const TARGET_SCORE = 90;

/**
 * Weighted average across the disciplines that have a score. Missing
 * disciplines are dropped and the remaining weights renormalized, so a
 * partly-scored quarter is not understated. Returns null when nothing is
 * scored.
 */
export function weightedOverall(scores: DisciplineScores): number | null {
  let weighted = 0;
  let weight = 0;
  for (const d of DISCIPLINES) {
    const score = scores[d.id];
    if (score === undefined || score === null) continue;
    weighted += score * d.weight;
    weight += d.weight;
  }
  if (weight === 0) return null;
  return Math.round((weighted / weight + Number.EPSILON) * 100) / 100;
}

/** How far a score sits below the 90% target (0 when already at or above). */
export function gapToTarget(score: number | null): number | null {
  if (score === null) return null;
  return Math.max(0, Math.round((TARGET_SCORE - score + Number.EPSILON) * 100) / 100);
}

/** 1-based rank with ties sharing a position, e.g. [90, 85, 85, 80] -> 1,2,2,4. */
export function rankScores(values: Array<number | null>): Array<number | null> {
  const sorted = [...values]
    .filter((v): v is number => v !== null)
    .sort((a, b) => b - a);
  return values.map((v) =>
    v === null ? null : sorted.findIndex((s) => s === v) + 1,
  );
}

/** "1st", "2nd", "3rd", … as used in the scorecard's Remarks column. */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
