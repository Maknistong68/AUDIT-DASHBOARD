/**
 * EHSS Quarterly Performance Review — domain model.
 * Mirrors the "Excellence EHSS Quarterly Performance Review" workbook
 * (Health & Safety checklist): weighted questions in sections/sub-sections,
 * Full / Partial / No / N-A answers, and the workbook's scoring formula.
 */

import { bandFor, type Band } from "./bands";
import type { DomainId } from "./domains";

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
  /** SHEW pillar this control belongs to — see ./domains. */
  domain: DomainId;
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
 * Issue categories live in ./issues — a fixed, multi-select taxonomy of WHY
 * a requirement was not met, chosen at entry time. The old single-select
 * OB1–OB5 codes are superseded; `readIssues` in that module accepts them so
 * records written before the change still load.
 */
export type { IssueCode, IssueCategory } from "./issues";
export {
  ISSUE_CATEGORIES,
  ISSUE_BY_CODE,
  GAP_CATEGORIES,
  readIssues,
} from "./issues";

/** Rating bands — defined once in ./bands, which also carries their colours,
 * so the label a badge shows and the colour a bar takes can never drift. */
export type RatingBand = Band;

export { BANDS as RATING_BANDS, bandFor } from "./bands";

export function ratingFor(percent: number | null): string | null {
  return bandFor(percent)?.label ?? null;
}

export type EhssAuditStatus = "draft" | "submitted" | "approved";

export interface EhssResponse {
  answer: EhssAnswer;
  /**
   * Why the requirement was not met. At least one gap category is required
   * on a Partial or No; a Full answer may carry "GOOD" and nothing else;
   * N/A carries none. Several categories are normal — a finding usually has
   * more than one cause, and forcing one label loses the rest.
   */
  issues: import("./issues").IssueCode[];
}

export interface SubRegion {
  id: string;
  name: string;
}

export interface EhssContractor {
  id: string;
  /**
   * The last three digits of the work order — all the app holds of it.
   * Contractors read as initials + those digits ("SIBS (838)"), which is
   * deliberately vague: it is enough to tell two projects apart and trend
   * them, and not enough to identify anyone. See ./recorded.
   */
  code: string;
  /** Initials only — never a full company name, and never a person. */
  name: string;
  subRegionId: string;
  /** Contractors are deactivated when their project completes: they keep
   * their audit history but drop out of the active league table and out of
   * the quarterly review obligation. */
  active: boolean;
}

/**
 * One checklist area's raw points, as a historical audit recorded them:
 * section A, B1–B12, C1 or C2. `possible` is the applicable weight, so it
 * varies between audits — N/A questions drop out of it, which is the
 * workbook's own rule.
 */
export interface RecordedArea {
  scored: number;
  possible: number;
}

export type RecordedAreaScores = Record<string, RecordedArea>;

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
  /**
   * Critical Risk Control focus audit — a score per hazardous-work item the
   * contractor's scope involves. Hazards outside scope are absent, never 0.
   * Like Health & Safety, a recorded `disciplineScores.crc` wins over the
   * figure derived from these.
   */
  criticalRisks: import("./critical-risks").CriticalRiskScores;
  /**
   * Answers for every checklist OTHER than Health & Safety, keyed by scope
   * id — `"env"`, `"sec"`, `"ww"`, or `"crc:<hazard>"` for each of the
   * fourteen Critical Risk hazard checklists. See ./scopes.
   *
   * H&S stays in `responses` above rather than moving in here: that field
   * is what every existing view, the recurrence machinery and every record
   * already saved in a browser use, and relocating it would orphan all of
   * them to make one shape prettier.
   */
  scopedResponses?: Record<string, Record<string, EhssResponse>>;
  /**
   * Area points from an audit recorded before this app existed, keyed by
   * checklist area ("A", "B6", "C2"). Historical audits were kept as a
   * narrative per question with no machine-readable answer, so the area
   * points are the finest real grain available. An area scores from these
   * until every one of its questions has an answer, and from the answers
   * after that — per area, so re-auditing one area never discards the rest.
   * An audit entered through the app leaves this unset.
   */
  areaScores?: RecordedAreaScores;
  /**
   * The total the source sheet stated, where it was transcribed from one.
   * Kept because it disagrees with that sheet's own points in 7 of the 20
   * imported audits: the app scores the points and shows the stated figure
   * beside it rather than quietly choosing between them.
   */
  reportedTotal?: number;
}

/** Display name: initials and the work order's last three digits, "SIBS (838)". */
export const contractorLabel = (c: { name: string; code: string }) =>
  `${c.name} (${c.code})`;

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

/** A quarter as a sortable integer: "2026-Q1" -> 8105. */
function quarterOrdinal(quarter: string): number {
  const [yearStr, qStr] = quarter.split("-");
  return Number(yearStr) * 4 + Number((qStr ?? "Q1").slice(1)) - 1;
}

/** Every quarter from `from` to `to` inclusive, oldest first. */
export function quartersBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  // Guard rather than trust: a reversed or malformed pair must not spin.
  for (let i = 0; i <= 400 && quarterOrdinal(cursor) <= quarterOrdinal(to); i++) {
    out.push(cursor);
    cursor = nextQuarter(cursor);
  }
  return out;
}

/**
 * The quarters a review may be dated to: a CONTINUOUS range from the
 * earliest quarter on record (or the previous one, whichever is earlier) up
 * to the current quarter. Never the next.
 *
 * Continuous is the point. This used to be "the ones on record, plus the
 * current and the previous", which SKIPPED any quarter nobody audited — in
 * October 2026 the list ran Q4 2025, Q1 2026, Q3 2026, Q4 2026 and Q2 2026
 * did not exist at all. A quarter the programme missed has to be visible as
 * missed, not absent; you cannot notice a gap that was never offered.
 *
 * No future quarter (owner's direction, 2026-10-14): an audit for a quarter
 * nobody has audited is a draft dated after today. One definition, used by
 * the reviews list and the audit page alike — two copies of a rule like this
 * drift, and then a review can be opened for a quarter the list cannot show.
 */
export function auditableQuarters(known: string[], today = new Date()): string[] {
  const current = quarterOf(today);
  const earliest = [...known, previousQuarter(current)].sort(
    (a, b) => quarterOrdinal(a) - quarterOrdinal(b),
  )[0]!;
  // A record dated beyond today (bad import, clock skew) still has to be
  // reachable, or the review it belongs to cannot be opened.
  const latest = [...known, current].sort(
    (a, b) => quarterOrdinal(b) - quarterOrdinal(a),
  )[0]!;
  return quartersBetween(earliest, latest).reverse();
}

/**
 * Why a contractor field would be refused.
 *
 * Contractors are INITIALS plus the last three digits of the work order and
 * nothing else — `SIBS (838)`, `AF (272)`. That is a compliance position,
 * not a display choice: §4 of `docs/COMPLIANCE-KSA.md` lets this data live
 * outside the Kingdom precisely because it identifies nobody and nothing,
 * and a register that lets someone type a full company name or a whole work
 * order quietly voids it.
 *
 * So the rule is enforced at the point of entry rather than left to the
 * convention it used to be. Returns null when the value is acceptable.
 */
export function contractorFieldProblem(
  field: "name" | "code",
  value: string,
): string | null {
  const text = value.trim();
  if (text.length === 0) return "required";
  if (field === "code") {
    return /^\d{3}$/.test(text)
      ? null
      : "the last three digits of the work order, and only those";
  }
  // A space first: it is the clearest signal that somebody typed a name,
  // and "no spaces" tells them what to do where "too long" does not.
  if (/\s/.test(text)) return "initials only — no spaces";
  // Room for a short suffix like "OT2" or "D&B", but not for a company name.
  if (text.length > 8) return "initials only — this is too long to be initials";
  return /^[A-Za-z0-9&-]+$/.test(text)
    ? null
    : "letters, digits, & and - only";
}
