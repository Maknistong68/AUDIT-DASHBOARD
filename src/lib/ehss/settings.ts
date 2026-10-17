/**
 * Programme settings, versioned by the quarter they take effect.
 *
 * The 90% target and the five discipline weights are constants in the code
 * today. The moment an admin can change them, there is a trap waiting that
 * is worth more care than the feature:
 *
 *   CHANGING A TARGET MUST NOT RESTATE THE PAST.
 *
 * If "below target" reads one global number, then raising the target from
 * 90 to 95 silently rewrites every quarter already reported. Last
 * quarter's board said four contractors were below target; it now says
 * nine, the minutes of that meeting no longer match the system, and
 * nobody changed an audit. The same applies to the weights: re-weighting
 * Critical Risk would restate every overall score ever shown.
 *
 * So a setting is not a value, it is a value WITH A QUARTER IT STARTS IN,
 * and a quarter is always judged by the settings in force when it was
 * audited. That is the whole design, and it is the reason this file exists
 * before the UI that edits it.
 *
 * STATUS: the mechanism and its rules are built and pinned. The editing UI
 * is NOT wired yet, deliberately — `TARGET_SCORE` is read directly in 53
 * places, and a target that half the screen respects is worse than one
 * nobody can change. Migrating those call sites to `targetFor(quarter)` is
 * the next concrete step; the ten that make a per-quarter JUDGEMENT rather
 * than drawing a line are the ones that matter, and they are listed in
 * docs/FIX-PLAN.md.
 */

import { DISCIPLINES, TARGET_SCORE, type DisciplineId } from "./disciplines";

export interface ProgrammeSettings {
  /**
   * The first quarter these settings apply to. Everything from here until
   * the next entry is judged by them.
   */
  effectiveFrom: string;
  /** The score a compliant contractor is expected to reach. */
  targetScore: number;
  /** Fraction of the overall score each discipline carries. */
  weights: Record<DisciplineId, number>;
  /** Why it changed — for the trail and for whoever reads it later. */
  note?: string;
}

/**
 * The settings the programme has always run on, as one entry effective
 * from before any audit on record. The values are exactly today's
 * constants, so introducing this file changes no figure anywhere.
 */
export const BASELINE_SETTINGS: ProgrammeSettings = {
  effectiveFrom: "0000-Q1",
  targetScore: TARGET_SCORE,
  weights: Object.fromEntries(
    DISCIPLINES.map((d) => [d.id, d.weight]),
  ) as Record<DisciplineId, number>,
  note: "The scorecard as originally issued.",
};

/** `2026-Q1` -> sortable integer. */
function ordinal(quarter: string): number {
  const [year, q] = quarter.split("-");
  return Number(year) * 4 + Number((q ?? "Q1").slice(1));
}

/**
 * The settings in force for a quarter: the latest entry that had already
 * taken effect by then.
 *
 * A quarter before every entry falls back to the baseline rather than
 * throwing — a review imported from before the programme wrote anything
 * down still has to be scoreable.
 */
export function settingsFor(
  history: ProgrammeSettings[],
  quarter: string,
): ProgrammeSettings {
  const applicable = history
    .filter((s) => ordinal(s.effectiveFrom) <= ordinal(quarter))
    .sort((a, b) => ordinal(b.effectiveFrom) - ordinal(a.effectiveFrom))[0];
  return applicable ?? BASELINE_SETTINGS;
}

/** The target a quarter is judged against. */
export const targetFor = (
  history: ProgrammeSettings[],
  quarter: string,
): number => settingsFor(history, quarter).targetScore;

/** The weights a quarter's overall score is computed with. */
export const weightsFor = (
  history: ProgrammeSettings[],
  quarter: string,
): Record<DisciplineId, number> => settingsFor(history, quarter).weights;

export interface SettingsProblem {
  entry: ProgrammeSettings;
  problem: string;
}

/**
 * What would make a settings history unusable.
 *
 * Checked before a change is accepted rather than discovered when a board
 * renders a NaN: two entries claiming the same quarter have no defined
 * winner, weights that do not sum to 1 make every overall score wrong in a
 * way nobody would spot, and a target outside 0–100 makes "below target"
 * meaningless.
 */
export function validateSettings(
  history: ProgrammeSettings[],
): SettingsProblem[] {
  const problems: SettingsProblem[] = [];
  const seen = new Set<string>();

  for (const entry of history) {
    if (!/^\d{4}-Q[1-4]$/.test(entry.effectiveFrom)) {
      problems.push({ entry, problem: "effective quarter is not a quarter" });
    }
    if (seen.has(entry.effectiveFrom)) {
      problems.push({
        entry,
        problem: `two entries take effect in ${entry.effectiveFrom}`,
      });
    }
    seen.add(entry.effectiveFrom);

    if (
      !Number.isFinite(entry.targetScore) ||
      entry.targetScore <= 0 ||
      entry.targetScore > 100
    ) {
      problems.push({ entry, problem: "target must be between 0 and 100" });
    }

    const total = DISCIPLINES.reduce(
      (sum, d) => sum + (entry.weights[d.id] ?? 0),
      0,
    );
    // A hundredth of slack for the decimals; anything more is a mistake.
    if (Math.abs(total - 1) > 0.001) {
      problems.push({
        entry,
        problem: `weights sum to ${(total * 100).toFixed(1)}%, not 100%`,
      });
    }
  }
  return problems;
}

/**
 * Add a change to the history, refusing one that would restate the past.
 *
 * A new entry may only take effect in a quarter that has not been reported
 * yet. Backdating one is not an edit, it is a retrospective rewrite of
 * every board, minute and report that already quoted the old number — and
 * the one thing this whole file exists to prevent.
 */
export function addSettings(
  history: ProgrammeSettings[],
  entry: ProgrammeSettings,
  earliestOpenQuarter: string,
): { history: ProgrammeSettings[]; problems: SettingsProblem[] } {
  const problems = validateSettings([...history, entry]);
  if (ordinal(entry.effectiveFrom) < ordinal(earliestOpenQuarter)) {
    problems.push({
      entry,
      problem:
        `cannot take effect in ${entry.effectiveFrom}: that quarter is ` +
        `already reported, and changing it would restate it`,
    });
  }
  return problems.length > 0
    ? { history, problems }
    : {
        history: [...history, entry].sort(
          (a, b) => ordinal(a.effectiveFrom) - ordinal(b.effectiveFrom),
        ),
        problems: [],
      };
}
