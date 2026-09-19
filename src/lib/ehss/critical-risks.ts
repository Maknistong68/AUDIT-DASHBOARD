/**
 * Critical Risk Control (CRC) — the hazardous-work register.
 *
 * CRC is the second of the five scorecard disciplines (25% of the overall
 * score). Unlike the EHSS site walk, which asks the same 81 questions of
 * every contractor, CRC is a FOCUS audit: each of the hazards below has its
 * own checklist, and a contractor is only audited against the hazards its
 * scope of work actually involves. A contractor with no marine works is
 * never scored on Working on or Near Water, and scoring it zero would be
 * wrong — so a hazard outside scope is simply absent, never 0.
 *
 * The register order matches the client's own CRC hazard list.
 *
 * Each hazard also carries its SHEW pillar, so CRC findings group alongside
 * the site-walk findings in the same pillar view (see ./domains).
 */

import type { DomainId } from "./domains";

export type CriticalRiskId =
  | "ground"
  | "confined"
  | "energized"
  | "explosives"
  | "fire"
  | "hotwork"
  | "lifting"
  | "plant"
  | "temporary"
  | "driving"
  | "height"
  | "heat"
  | "roads"
  | "water";

export interface CriticalRisk {
  id: CriticalRiskId;
  label: string;
  /** SHEW pillar the hazard belongs to. */
  domain: DomainId;
  /**
   * Roughly how many contractors carry this hazard in scope (0-1). It drives
   * the demo dataset only — real applicability comes from the contractor's
   * scope of work.
   */
  prevalence: number;
}

export const CRITICAL_RISKS: CriticalRisk[] = [
  { id: "ground",     label: "Breaking Ground & Excavation",   domain: "safety", prevalence: 0.85 },
  { id: "confined",   label: "Confined Spaces",                domain: "safety", prevalence: 0.5 },
  { id: "energized",  label: "Energized System",               domain: "safety", prevalence: 0.7 },
  { id: "explosives", label: "Explosives & Blasting",          domain: "safety", prevalence: 0.15 },
  { id: "fire",       label: "Fire",                           domain: "safety", prevalence: 0.95 },
  { id: "hotwork",    label: "Hot Work",                       domain: "safety", prevalence: 0.85 },
  { id: "lifting",    label: "Lifting",                        domain: "safety", prevalence: 0.95 },
  { id: "plant",      label: "Mobile Plant & Equipment",       domain: "safety", prevalence: 0.95 },
  { id: "temporary",  label: "Temporary Works",                domain: "safety", prevalence: 0.75 },
  { id: "driving",    label: "Driving",                        domain: "safety", prevalence: 1 },
  { id: "height",     label: "Working at Height",              domain: "safety", prevalence: 0.95 },
  // Heat stress is an occupational-health control, not a physical-safety one.
  { id: "heat",       label: "Working in Heat",                domain: "health", prevalence: 1 },
  { id: "roads",      label: "Working on or Near Live Roads",  domain: "safety", prevalence: 0.55 },
  { id: "water",      label: "Working on or Near Water",       domain: "safety", prevalence: 0.25 },
];

export const CRITICAL_RISK_BY_ID: Record<CriticalRiskId, CriticalRisk> =
  Object.fromEntries(CRITICAL_RISKS.map((r) => [r.id, r])) as Record<
    CriticalRiskId,
    CriticalRisk
  >;

/**
 * Per-hazard CRC scores (0-100) for one review. A hazard missing from the
 * record is OUT OF SCOPE for that contractor, not a zero — the same
 * convention the site-walk checklist uses for N/A.
 */
export type CriticalRiskScores = Partial<Record<CriticalRiskId, number>>;

/** The hazards in scope for a review, in register order. */
export function scopedRisks(scores: CriticalRiskScores): CriticalRisk[] {
  return CRITICAL_RISKS.filter((r) => scores[r.id] !== undefined);
}

/**
 * The Critical Risk Control discipline score: the mean of the hazards in
 * scope. Hazards outside scope are excluded from numerator and denominator,
 * so a contractor is not rewarded or punished for work it does not do.
 * Returns null when no hazard is in scope.
 */
export function crcScore(scores: CriticalRiskScores): number | null {
  const values = CRITICAL_RISKS.map((r) => scores[r.id]).filter(
    (v): v is number => v !== undefined,
  );
  if (values.length === 0) return null;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round((mean + Number.EPSILON) * 100) / 100;
}
