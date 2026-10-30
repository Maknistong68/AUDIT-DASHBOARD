/**
 * The observation log's search and filter, as pure functions.
 *
 * The page (and its URL) hold a `LogFilter`; everything here is derived from
 * it. Nothing imports `recorded-observations.ts` — the caller hands in the
 * observations it loaded.
 */

import { CHECKLIST } from "./checklist";
import { GAP_CATEGORIES, type IssueCode } from "./issues";
import { contractorLabel, type ObservationKind, type RecordedObservation } from "./model";
import { checklistAreas, type AuditSummary } from "./summaries";

export interface LogFilter {
  q: string;
  quarter?: string;
  subRegionId?: string;
  contractorId?: string;
  /** Checklist area code: "A", "B1".."B12", "C1", "C2". */
  area?: string;
  cause?: IssueCode;
  kind?: ObservationKind;
  needsCause?: boolean;
}

export interface LogRow extends RecordedObservation {
  quarter: string;
  contractorId: string;
  /** Display form, "ABYA (112)", so searching either half finds it. */
  contractorName: string;
  subRegionId: string;
  area: string | null;
}

const GAP_CODES: IssueCode[] = GAP_CATEGORIES.map((c) => c.code);
const KINDS: ObservationKind[] = ["gap", "positive", "site"];

/** Question code -> area code, grouped exactly as `checklistAreas()` does:
 * a section's bare questions (A) belong to the section, the rest to their
 * sub-section. */
let areaByQuestion: Map<string, string> | null = null;
function areaOf(questionCode: string | null): string | null {
  if (questionCode === null) return null;
  if (!areaByQuestion) {
    areaByQuestion = new Map();
    for (const section of CHECKLIST) {
      for (const ss of section.subSections) {
        for (const q of ss.questions) areaByQuestion.set(q.code, ss.code ?? section.code);
      }
    }
  }
  return areaByQuestion.get(questionCode) ?? null;
}

/** Join each observation to its audit. One whose audit has no summary is
 * dropped rather than thrown on. */
export function toLogRows(
  observations: RecordedObservation[],
  summaries: AuditSummary[],
): LogRow[] {
  const byAudit = new Map(summaries.map((s) => [s.id, s]));
  const rows: LogRow[] = [];
  for (const o of observations) {
    const s = byAudit.get(o.auditId);
    if (!s) continue;
    rows.push({
      ...o,
      quarter: s.quarter,
      contractorId: s.contractorId,
      contractorName: contractorLabel({ name: s.contractorName, code: s.contractorCode }),
      subRegionId: s.subRegionId,
      area: areaOf(o.questionCode),
    });
  }
  return rows;
}

const hasGapCause = (r: LogRow) => r.causes.some((c) => GAP_CODES.includes(c));

/** Narrow the rows, keeping their order. Search is literal: every
 * whitespace-separated term must appear, case-insensitively, in the text,
 * the question code or the contractor. */
export function filterLog(rows: LogRow[], f: LogFilter): LogRow[] {
  const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((r) => {
    if (f.quarter && r.quarter !== f.quarter) return false;
    if (f.subRegionId && r.subRegionId !== f.subRegionId) return false;
    if (f.contractorId && r.contractorId !== f.contractorId) return false;
    if (f.area && r.area !== f.area) return false;
    if (f.cause && !r.causes.includes(f.cause)) return false;
    if (f.kind && r.kind !== f.kind) return false;
    if (f.needsCause && (r.kind === "positive" || hasGapCause(r))) return false;
    if (terms.length > 0) {
      const hay = [r.text, r.questionCode ?? "", r.contractorName].map((s) => s.toLowerCase());
      if (!terms.every((t) => hay.some((h) => h.includes(t)))) return false;
    }
    return true;
  });
}

/** The seven gap causes in fixed order, zeros kept. Causes are multi-select,
 * so the counts can sum to more than the number of rows. */
export function causeCounts(rows: LogRow[]): { code: IssueCode; count: number }[] {
  return GAP_CODES.map((code) => ({
    code,
    count: rows.reduce((n, r) => n + (r.causes.includes(code) ? 1 : 0), 0),
  }));
}

/** Read a filter from a URL, keeping only values it knows. An id cannot be
 * checked without data, so it passes through and simply matches nothing. */
export function parseLogFilter(params: URLSearchParams): LogFilter {
  const f: LogFilter = { q: params.get("q") ?? "" };
  const quarter = params.get("quarter");
  if (quarter && /^\d{4}-Q[1-4]$/.test(quarter)) f.quarter = quarter;
  const subRegionId = params.get("subRegionId");
  if (subRegionId) f.subRegionId = subRegionId;
  const contractorId = params.get("contractorId");
  if (contractorId) f.contractorId = contractorId;
  const area = params.get("area");
  if (area && checklistAreas().some((a) => a.code === area)) f.area = area;
  const cause = params.get("cause") as IssueCode | null;
  if (cause && GAP_CODES.includes(cause)) f.cause = cause;
  const kind = params.get("kind") as ObservationKind | null;
  if (kind && KINDS.includes(kind)) f.kind = kind;
  const needs = params.get("needsCause");
  if (needs === "1" || needs === "true") f.needsCause = true;
  return f;
}

/** The inverse of `parseLogFilter`; empty fields are left out. */
export function logFilterToParams(f: LogFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q);
  if (f.quarter) p.set("quarter", f.quarter);
  if (f.subRegionId) p.set("subRegionId", f.subRegionId);
  if (f.contractorId) p.set("contractorId", f.contractorId);
  if (f.area) p.set("area", f.area);
  if (f.cause) p.set("cause", f.cause);
  if (f.kind) p.set("kind", f.kind);
  if (f.needsCause) p.set("needsCause", "1");
  return p;
}
