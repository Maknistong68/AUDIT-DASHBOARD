/**
 * EHSS Quarterly Performance Review — domain model.
 * Mirrors the "Excellence EHSS Quarterly Performance Review" workbook
 * (Health & Safety checklist): weighted questions in sections/sub-sections,
 * Full / Partial / No / N-A answers, and the workbook's scoring formula.
 */

/** Answer options — the workbook's dropdown (Full / Partial / No / N/A). */
export type EhssAnswer = "full" | "partial" | "no" | "na";

export const ANSWER_LABELS: Record<EhssAnswer, string> = {
  full: "Full",
  partial: "Partial",
  no: "No",
  na: "N/A",
};

/** Points multiplier per answer; N/A is excluded from the calculation. */
export const ANSWER_VALUE: Record<Exclude<EhssAnswer, "na">, number> = {
  full: 1,
  partial: 0.5,
  no: 0,
};

export interface ChecklistQuestion {
  code: string; // A1, B6.3, C2.14 …
  weight: number; // 1–4
  text: string;
}

export interface ChecklistSubSection {
  code: string | null; // null for section A (questions sit directly in it)
  title: string | null;
  questions: ChecklistQuestion[];
}

export interface ChecklistSection {
  code: string; // A, B, C
  title: string;
  subSections: ChecklistSubSection[];
}

/**
 * Pre-made observation options — the standardized "comment" recorded per
 * question instead of free text or photos, so findings can be analyzed
 * later. One of OB2–OB5 is required for a Partial or No answer; OB1 is the
 * optional positive note on a Full answer; N/A carries no observation.
 */
export type ObservationCode = "OB1" | "OB2" | "OB3" | "OB4" | "OB5";

export interface ObservationOption {
  code: ObservationCode;
  label: string;
  description: string;
  /** true when the option represents a gap (valid for Partial / No). */
  gap: boolean;
}

export const OBSERVATION_OPTIONS: ObservationOption[] = [
  {
    code: "OB1",
    label: "Good practice observed",
    description:
      "Requirement fully met with evidence of practice beyond the minimum.",
    gap: false,
  },
  {
    code: "OB2",
    label: "Documentation gap",
    description:
      "Required document/plan is missing, not approved (not Code A), or outdated.",
    gap: true,
  },
  {
    code: "OB3",
    label: "Implementation gap",
    description:
      "Documented requirement is not, or only partially, implemented on site.",
    gap: true,
  },
  {
    code: "OB4",
    label: "Resources / competence gap",
    description:
      "Insufficient staffing, supervision, training or competent persons.",
    gap: true,
  },
  {
    code: "OB5",
    label: "Monitoring / reporting gap",
    description:
      "Tracking, records, meetings, communication or reporting not evidenced.",
    gap: true,
  },
];

export const OBSERVATION_BY_CODE: Record<ObservationCode, ObservationOption> =
  Object.fromEntries(
    OBSERVATION_OPTIONS.map((o) => [o.code, o]),
  ) as Record<ObservationCode, ObservationOption>;

/** Rating bands from the workbook's score summary. */
export interface RatingBand {
  label: string;
  min: number; // percent, inclusive
}

export const RATING_BANDS: RatingBand[] = [
  { label: "Compliant", min: 90 },
  { label: "Mostly Compliant", min: 80 },
  { label: "Moderately Compliant", min: 70 },
  { label: "Minimally Compliant", min: 60 },
  { label: "Non-Compliant", min: 0 },
];

export function ratingFor(percent: number | null): string | null {
  if (percent === null) return null;
  return RATING_BANDS.find((b) => percent >= b.min)?.label ?? null;
}

export type EhssAuditStatus = "draft" | "submitted" | "approved";

export interface EhssResponse {
  answer: EhssAnswer;
  observation: ObservationCode | null;
}

export interface SubRegion {
  id: string;
  name: string;
}

export interface EhssContractor {
  id: string;
  /** Project / work-order number, as used on the scorecard: "Al Fahd (1272)". */
  code: string;
  name: string; // organizational name only — never a person
  subRegionId: string;
  /** Contractors are deactivated when their project completes: they keep
   * their audit history but drop out of the active league table and out of
   * the quarterly review obligation. */
  active: boolean;
}

export interface EhssAudit {
  id: string;
  contractorId: string;
  quarter: string; // "2026-Q1"
  auditDate: string; // ISO date
  inspectionNo: string; // e.g. "HSW-03"
  status: EhssAuditStatus;
  /** Health & Safety checklist answers (question code -> response). */
  responses: Record<string, EhssResponse>;
  /**
   * Recorded discipline scores (0-100). Health & Safety is taken from the
   * checklist whenever the checklist has been answered, and from this value
   * otherwise — the other four disciplines always come from here until their
   * own checklists exist.
   */
  disciplineScores: import("./disciplines").DisciplineScores;
}

export function quarterLabel(quarter: string): string {
  const [year, q] = quarter.split("-");
  return `${q} ${year}`;
}

/** The quarter a date falls in, as "YYYY-Qn". */
export function quarterOf(date: Date): string {
  return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
}

/** Chronologically next quarter, e.g. "2026-Q4" -> "2027-Q1". */
export function nextQuarter(quarter: string): string {
  const [yearStr, qStr] = quarter.split("-");
  const year = Number(yearStr);
  const q = Number((qStr ?? "Q1").slice(1));
  return q === 4 ? `${year + 1}-Q1` : `${year}-Q${q + 1}`;
}

/** Chronologically previous quarter, e.g. "2026-Q1" -> "2025-Q4". */
export function previousQuarter(quarter: string): string {
  const [yearStr, qStr] = quarter.split("-");
  const year = Number(yearStr);
  const q = Number((qStr ?? "Q1").slice(1));
  return q === 1 ? `${year - 1}-Q4` : `${year}-Q${q - 1}`;
}
