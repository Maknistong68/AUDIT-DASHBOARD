/**
 * Derived, serializable views over the audit data — safe for both server
 * pages and the client dashboard (pure functions, no server imports).
 */

import { CHECKLIST } from "./checklist";
import { flattenChecklist, scoreAudit } from "./scoring";
import {
  ratingFor,
  type EhssAudit,
  type EhssContractor,
  type ObservationCode,
  type SubRegion,
} from "./model";

export interface SectionSummary {
  code: string;
  title: string;
  score: number | null;
}

export interface SubSectionSummary {
  section: string;
  code: string | null;
  title: string | null;
  score: number | null;
}

export interface AuditSummary {
  id: string;
  contractorId: string;
  contractorCode: string;
  contractorName: string;
  subRegionId: string;
  subRegionName: string;
  quarter: string;
  auditDate: string;
  inspectionNo: string;
  status: EhssAudit["status"];
  total: number | null;
  rating: string | null;
  sections: SectionSummary[];
  subSections: SubSectionSummary[];
}

export interface ObservationRow {
  auditId: string;
  contractorId: string;
  contractorName: string;
  subRegionId: string;
  quarter: string;
  questionCode: string;
  questionText: string;
  subSectionTitle: string | null;
  sectionCode: string;
  answer: "partial" | "no";
  observation: ObservationCode;
}

const FLAT = flattenChecklist(CHECKLIST);

export function summarizeAudit(
  audit: EhssAudit,
  contractor: EhssContractor,
  subRegion: SubRegion,
): AuditSummary {
  const score = scoreAudit(CHECKLIST, audit.responses);
  return {
    id: audit.id,
    contractorId: contractor.id,
    contractorCode: contractor.code,
    contractorName: contractor.name,
    subRegionId: subRegion.id,
    subRegionName: subRegion.name,
    quarter: audit.quarter,
    auditDate: audit.auditDate,
    inspectionNo: audit.inspectionNo,
    status: audit.status,
    total: score.total,
    rating: ratingFor(score.total),
    sections: score.sections.map((s) => ({
      code: s.code,
      title: s.title,
      score: s.score,
    })),
    subSections: score.sections.flatMap((s) =>
      s.subSections
        .filter((ss) => ss.code !== null)
        .map((ss) => ({
          section: s.code,
          code: ss.code,
          title: ss.title,
          score: ss.score,
        })),
    ),
  };
}

export function summarizeAll(
  audits: EhssAudit[],
  contractors: EhssContractor[],
  subRegions: SubRegion[],
): AuditSummary[] {
  const cById = new Map(contractors.map((c) => [c.id, c]));
  const sById = new Map(subRegions.map((s) => [s.id, s]));
  return audits.map((a) => {
    const c = cById.get(a.contractorId)!;
    return summarizeAudit(a, c, sById.get(c.subRegionId)!);
  });
}

/** Every gap observation (Partial/No answers) from finalized audits. */
export function collectObservations(
  audits: EhssAudit[],
  contractors: EhssContractor[],
): ObservationRow[] {
  const cById = new Map(contractors.map((c) => [c.id, c]));
  const rows: ObservationRow[] = [];
  for (const audit of audits) {
    if (audit.status === "draft") continue;
    const contractor = cById.get(audit.contractorId)!;
    for (const item of FLAT) {
      const r = audit.responses[item.question.code];
      if (!r || (r.answer !== "partial" && r.answer !== "no")) continue;
      if (!r.observation) continue;
      rows.push({
        auditId: audit.id,
        contractorId: contractor.id,
        contractorName: contractor.name,
        subRegionId: contractor.subRegionId,
        quarter: audit.quarter,
        questionCode: item.question.code,
        questionText: item.question.text,
        subSectionTitle: item.subSectionTitle,
        sectionCode: item.section,
        answer: r.answer,
        observation: r.observation,
      });
    }
  }
  return rows;
}

/** Finalized audits only (drafts never feed analytics). */
export const finalized = (summaries: AuditSummary[]) =>
  summaries.filter((s) => s.status !== "draft");

export function averageByQuarter(
  summaries: AuditSummary[],
): Array<{ quarter: string; score: number }> {
  const byQuarter = new Map<string, number[]>();
  for (const s of finalized(summaries)) {
    if (s.total === null) continue;
    const list = byQuarter.get(s.quarter) ?? [];
    list.push(s.total);
    byQuarter.set(s.quarter, list);
  }
  return [...byQuarter.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([quarter, scores]) => ({
      quarter,
      score:
        Math.round(
          (scores.reduce((sum, v) => sum + v, 0) / scores.length) * 10,
        ) / 10,
    }));
}

/** Latest finalized audit per contractor. */
export function latestByContractor(summaries: AuditSummary[]): AuditSummary[] {
  const latest = new Map<string, AuditSummary>();
  for (const s of finalized(summaries)) {
    const cur = latest.get(s.contractorId);
    if (!cur || s.quarter.localeCompare(cur.quarter) > 0) {
      latest.set(s.contractorId, s);
    }
  }
  return [...latest.values()];
}

/** Mean sub-section score across the given audits, weakest first. */
export function weakestSubSections(
  summaries: AuditSummary[],
  limit: number,
): Array<{ section: string; code: string; title: string; avg: number; n: number }> {
  const acc = new Map<string, { section: string; title: string; sum: number; n: number }>();
  for (const s of finalized(summaries)) {
    for (const ss of s.subSections) {
      if (ss.score === null || ss.code === null) continue;
      const cur = acc.get(ss.code) ?? {
        section: ss.section,
        title: ss.title ?? ss.code,
        sum: 0,
        n: 0,
      };
      cur.sum += ss.score;
      cur.n += 1;
      acc.set(ss.code, cur);
    }
  }
  return [...acc.entries()]
    .map(([code, v]) => ({
      section: v.section,
      code,
      title: v.title,
      avg: Math.round((v.sum / v.n) * 10) / 10,
      n: v.n,
    }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, limit);
}
