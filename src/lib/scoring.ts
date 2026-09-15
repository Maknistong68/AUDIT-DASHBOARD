/**
 * Scoring and aggregation logic — the client-side mirror of
 * public.calculate_audit_score in supabase/migrations/0002_scoring.sql.
 *
 * The database is the source of truth (the trigger keeps audits.score
 * current); this module exists so the audit-entry UI can show a live
 * provisional score while the auditor works, and so dashboard code can
 * aggregate without round-trips.
 *
 * Rules:
 *   full_compliance -> weight counts fully
 *   non_compliance  -> weight counts as zero
 *   not_applicable  -> excluded from numerator and denominator
 *   observations    -> never part of scoring
 */

import type { ScorableResponse } from "./types";

/**
 * Weighted compliance score in percent, rounded to 2 decimals.
 * Returns null when there are no applicable responses (matching the DB,
 * where an all-NA audit has a NULL score rather than 0).
 */
export function computeScore(responses: readonly ScorableResponse[]): number | null {
  let achieved = 0;
  let applicable = 0;

  for (const r of responses) {
    if (!(r.weight > 0)) {
      throw new Error(`invalid question weight: ${r.weight}`);
    }
    if (r.result === "not_applicable") continue;
    applicable += r.weight;
    if (r.result === "full_compliance") achieved += r.weight;
  }

  if (applicable === 0) return null;
  return round2((achieved / applicable) * 100);
}

/** One point of a contractor's score trend. */
export interface TrendPoint {
  auditDate: string; // ISO date
  score: number;
}

/**
 * Score delta across a chronological trend: latest minus earliest.
 * Returns null when fewer than two scored audits exist.
 */
export function trendDelta(points: readonly TrendPoint[]): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.auditDate.localeCompare(b.auditDate));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  return round2(last.score - first.score);
}

/** One non-compliance occurrence, as returned by v_nc_breakdown. */
export interface NcOccurrence {
  ncCategoryName: string;
}

/**
 * NC counts by classification, sorted most-frequent first, with each
 * classification's share of all NCs in percent.
 * This answers "what is the most common cause of non-compliance?"
 */
export function ncCategoryBreakdown(
  occurrences: readonly NcOccurrence[],
): Array<{ name: string; count: number; share: number }> {
  const counts = new Map<string, number>();
  for (const o of occurrences) {
    counts.set(o.ncCategoryName, (counts.get(o.ncCategoryName) ?? 0) + 1);
  }
  const total = occurrences.length;
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, share: round2((count / total) * 100) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
