/**
 * Derived, serializable views over the audit data — pure functions shared by
 * the dashboard, contractor pages and findings register (no server imports).
 */

import { CHECKLIST } from "./checklist";
import { flattenChecklist, scoreAudit } from "./scoring";
import { DOMAINS, type DomainId } from "./domains";
import {
  CRITICAL_RISKS,
  crcScore,
  type CriticalRiskId,
  type CriticalRiskScores,
} from "./critical-risks";
import {
  DISCIPLINES,
  TARGET_SCORE,
  gapToTarget,
  weightedOverall,
  type DisciplineId,
  type DisciplineScores,
} from "./disciplines";
import {
  ANSWER_VALUE,
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
  contractorActive: boolean;
  subRegionId: string;
  subRegionName: string;
  quarter: string;
  auditDate: string;
  inspectionNo: string;
  status: EhssAudit["status"];
  /** Health & Safety checklist total (the 81-question score). */
  total: number | null;
  /** Score per discipline — H&S falls back to the checklist total. */
  disciplineScores: DisciplineScores;
  /** Weighted average across the five disciplines: the scorecard figure. */
  overall: number | null;
  /** CRC focus-audit scores per hazardous-work item in the contractor's scope. */
  criticalRisks: CriticalRiskScores;
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
  /** SHEW pillar the audited control belongs to. */
  domain: DomainId;
  answer: "partial" | "no";
  observation: ObservationCode;
}

const FLAT = flattenChecklist(CHECKLIST);
/** Scores round to 2 decimals everywhere, matching the scoring engine —
 * so a single-review window reports exactly that review's total. */
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function summarizeAudit(
  audit: EhssAudit,
  contractor: EhssContractor,
  subRegion: SubRegion,
): AuditSummary {
  const score = scoreAudit(CHECKLIST, audit.responses);
  // The recorded score wins when present (transcribed scorecard value);
  // otherwise the detailed audit stands in — the checklist total for H&S,
  // the mean of the hazards in scope for Critical Risk Control.
  const disciplineScores: DisciplineScores = {
    ...audit.disciplineScores,
    hs: audit.disciplineScores.hs ?? score.total ?? undefined,
    crc: audit.disciplineScores.crc ?? crcScore(audit.criticalRisks) ?? undefined,
  };
  const overall = weightedOverall(disciplineScores);
  return {
    id: audit.id,
    contractorId: contractor.id,
    contractorCode: contractor.code,
    contractorName: contractor.name,
    contractorActive: contractor.active,
    subRegionId: subRegion.id,
    subRegionName: subRegion.name,
    quarter: audit.quarter,
    auditDate: audit.auditDate,
    inspectionNo: audit.inspectionNo,
    status: audit.status,
    total: score.total,
    disciplineScores,
    criticalRisks: audit.criticalRisks,
    overall,
    rating: ratingFor(overall),
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
  return audits.flatMap((a) => {
    const c = cById.get(a.contractorId);
    if (!c) return [];
    const sr = sById.get(c.subRegionId);
    return sr ? [summarizeAudit(a, c, sr)] : [];
  });
}

/** Finalized audits only — drafts never feed analytics. */
export const finalized = (summaries: AuditSummary[]) =>
  summaries.filter((s) => s.status !== "draft");

/* ------------------------------------------------------------------ */
/* Timeframe windows                                                   */
/* ------------------------------------------------------------------ */

/**
 * How much history the dashboard looks at. Reviews are quarterly, so a count
 * of recent audits per contractor is the honest unit: "last 4" is one year
 * of quarterly reviews.
 */
export type TimeframeId = "latest" | "last3" | "last4" | "all";

export interface Timeframe {
  id: TimeframeId;
  label: string;
  /** Audits per contractor to include; null = every audit. */
  count: number | null;
}

export const TIMEFRAMES: Timeframe[] = [
  { id: "latest", label: "Latest review", count: 1 },
  { id: "last3", label: "Last 3 reviews", count: 3 },
  { id: "last4", label: "Last year (4 quarters)", count: 4 },
  { id: "all", label: "All reviews", count: null },
];

export const timeframeById = (id: TimeframeId): Timeframe =>
  TIMEFRAMES.find((t) => t.id === id) ?? TIMEFRAMES[0]!;

/** Chronological finalized audits per contractor, trimmed to the window. */
export function windowByContractor(
  summaries: AuditSummary[],
  timeframe: TimeframeId,
): Map<string, AuditSummary[]> {
  const { count } = timeframeById(timeframe);
  const byContractor = new Map<string, AuditSummary[]>();
  for (const s of finalized(summaries)) {
    const list = byContractor.get(s.contractorId) ?? [];
    list.push(s);
    byContractor.set(s.contractorId, list);
  }
  for (const [id, list] of byContractor) {
    const sorted = list.sort((a, b) => a.quarter.localeCompare(b.quarter));
    byContractor.set(id, count === null ? sorted : sorted.slice(-count));
  }
  return byContractor;
}

export interface ContractorStats {
  contractorId: string;
  contractorCode: string;
  contractorName: string;
  subRegionId: string;
  subRegionName: string;
  active: boolean;
  /** Audits inside the window, oldest first. */
  audits: AuditSummary[];
  /** Mean total across the window — what the league-table bar shows. */
  avgScore: number | null;
  latestScore: number | null;
  latestQuarter: string | null;
  rating: string | null;
  /** Latest minus earliest inside the window (null with fewer than two). */
  delta: number | null;
  sectionAverages: Array<{ code: string; title: string; avg: number | null }>;
  /** Mean score per discipline across the window. */
  disciplineAverages: Array<{
    id: DisciplineId;
    name: string;
    weight: number;
    avg: number | null;
    gap: number | null;
  }>;
}

export function contractorStats(
  summaries: AuditSummary[],
  timeframe: TimeframeId,
): ContractorStats[] {
  const windows = windowByContractor(summaries, timeframe);
  const stats: ContractorStats[] = [];

  for (const [contractorId, list] of windows) {
    if (list.length === 0) continue;
    const head = list[list.length - 1]!;
    const scored = list.filter((s) => s.overall !== null);
    const avgScore =
      scored.length === 0
        ? null
        : round(scored.reduce((sum, s) => sum + s.overall!, 0) / scored.length);
    const first = scored[0];
    const last = scored[scored.length - 1];
    const delta =
      scored.length >= 2 && first && last
        ? round(last.overall! - first.overall!)
        : null;

    const sectionAverages = ["A", "B", "C"].map((code) => {
      const values = list
        .map((s) => s.sections.find((x) => x.code === code))
        .filter((x): x is SectionSummary => Boolean(x) && x!.score !== null);
      return {
        code,
        title: values[0]?.title ?? code,
        avg:
          values.length === 0
            ? null
            : round(
                values.reduce((sum, x) => sum + x.score!, 0) / values.length,
              ),
      };
    });

    const disciplineAverages = DISCIPLINES.map((d) => {
      const values = list
        .map((s) => s.disciplineScores[d.id])
        .filter((v): v is number => v !== undefined && v !== null);
      const avg =
        values.length === 0
          ? null
          : round(values.reduce((sum, v) => sum + v, 0) / values.length);
      return {
        id: d.id,
        name: d.name,
        weight: d.weight,
        avg,
        gap: gapToTarget(avg),
      };
    });

    stats.push({
      contractorId,
      contractorCode: head.contractorCode,
      contractorName: head.contractorName,
      subRegionId: head.subRegionId,
      subRegionName: head.subRegionName,
      active: head.contractorActive,
      audits: list,
      avgScore,
      latestScore: last?.overall ?? null,
      latestQuarter: last?.quarter ?? null,
      rating: ratingFor(avgScore),
      delta,
      sectionAverages,
      disciplineAverages,
    });
  }

  return stats.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
}

/* ------------------------------------------------------------------ */
/* Findings                                                            */
/* ------------------------------------------------------------------ */

/** Every gap observation (Partial/No answers) from finalized audits. */
export function collectObservations(
  audits: EhssAudit[],
  contractors: EhssContractor[],
): ObservationRow[] {
  const cById = new Map(contractors.map((c) => [c.id, c]));
  const rows: ObservationRow[] = [];
  for (const audit of audits) {
    if (audit.status === "draft") continue;
    const contractor = cById.get(audit.contractorId);
    if (!contractor) continue;
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
        domain: item.question.domain,
        answer: r.answer,
        observation: r.observation,
      });
    }
  }
  return rows;
}

export interface IssueRow {
  questionCode: string;
  questionText: string;
  sectionCode: string;
  subSectionTitle: string | null;
  weight: number;
  /** Reviews in scope where this question was Partial or No. */
  occurrences: number;
  noCount: number;
  partialCount: number;
  /** Weighted points lost — the question's actual impact on the score. */
  lostPoints: number;
  /** Most frequent standardized classification for this question. */
  topObservation: ObservationCode | null;
}

/**
 * The questions costing the most score across the given audits, ranked by
 * weighted points lost (a weight-4 "No" outranks a weight-1 "Partial").
 */
export function topIssues(audits: EhssAudit[], limit: number): IssueRow[] {
  const acc = new Map<
    string,
    Omit<IssueRow, "topObservation"> & { obs: Map<ObservationCode, number> }
  >();

  for (const audit of audits) {
    if (audit.status === "draft") continue;
    for (const item of FLAT) {
      const r = audit.responses[item.question.code];
      if (!r || (r.answer !== "partial" && r.answer !== "no")) continue;
      const cur =
        acc.get(item.question.code) ??
        {
          questionCode: item.question.code,
          questionText: item.question.text,
          sectionCode: item.section,
          subSectionTitle: item.subSectionTitle,
          weight: item.question.weight,
          occurrences: 0,
          noCount: 0,
          partialCount: 0,
          lostPoints: 0,
          obs: new Map<ObservationCode, number>(),
        };
      cur.occurrences += 1;
      if (r.answer === "no") cur.noCount += 1;
      else cur.partialCount += 1;
      cur.lostPoints +=
        item.question.weight * (1 - ANSWER_VALUE[r.answer]);
      if (r.observation) {
        cur.obs.set(r.observation, (cur.obs.get(r.observation) ?? 0) + 1);
      }
      acc.set(item.question.code, cur);
    }
  }

  return [...acc.values()]
    .map(({ obs, ...rest }) => ({
      ...rest,
      lostPoints: round(rest.lostPoints),
      topObservation:
        [...obs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort(
      (a, b) => b.lostPoints - a.lostPoints || b.occurrences - a.occurrences,
    )
    .slice(0, limit);
}

/** Gap observations grouped by classification, most frequent first. */
export function observationBreakdown(
  rows: ObservationRow[],
): Array<{ code: ObservationCode; count: number; share: number }> {
  const counts = new Map<ObservationCode, number>();
  for (const r of rows) counts.set(r.observation, (counts.get(r.observation) ?? 0) + 1);
  const total = rows.length;
  return [...counts.entries()]
    .map(([code, count]) => ({
      code,
      count,
      share: total ? round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/* ------------------------------------------------------------------ */
/* Program-level rollups                                               */
/* ------------------------------------------------------------------ */

export function averageByQuarter(
  summaries: AuditSummary[],
): Array<{ quarter: string; score: number }> {
  const byQuarter = new Map<string, number[]>();
  for (const s of finalized(summaries)) {
    if (s.overall === null) continue;
    const list = byQuarter.get(s.quarter) ?? [];
    list.push(s.overall);
    byQuarter.set(s.quarter, list);
  }
  return [...byQuarter.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([quarter, scores]) => ({
      quarter,
      score: round(scores.reduce((sum, v) => sum + v, 0) / scores.length),
    }));
}

/** Mean sub-section score across the given audits, weakest first. */
export function weakestSubSections(
  summaries: AuditSummary[],
  limit: number,
): Array<{ section: string; code: string; title: string; avg: number; n: number }> {
  const acc = new Map<
    string,
    { section: string; title: string; sum: number; n: number }
  >();
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
      avg: round(v.sum / v.n),
      n: v.n,
    }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, limit);
}

/** All quarters present in the data, newest first. */
export function knownQuarters(audits: EhssAudit[]): string[] {
  return [...new Set(audits.map((a) => a.quarter))].sort((a, b) =>
    b.localeCompare(a),
  );
}

/* ------------------------------------------------------------------ */
/* Executive brief: which areas are moving, and which are stuck        */
/* ------------------------------------------------------------------ */

export type AreaDirection = "improving" | "flat" | "declining";

export interface AreaTrend {
  /** Checklist sub-section code, e.g. "B6". */
  code: string;
  title: string;
  section: string;
  /** Scores across the reviews in the window, oldest first. */
  scores: number[];
  reviews: number;
  latest: number;
  average: number;
  /** Latest minus earliest; null when only one review covers the area. */
  change: number | null;
  direction: AreaDirection;
  gap: number | null;
}

/** A move of less than this many points is treated as no real change. */
const FLAT_BAND = 3;

/**
 * Score history per checklist sub-section across the given reviews — the
 * basis for "no improvement in the last four audits".
 */
export function areaTrends(summaries: AuditSummary[]): AreaTrend[] {
  // Group by quarter first, so a programme-wide brief trends the average of
  // that quarter's reviews rather than interleaving contractors.
  const quarters = [
    ...new Set(finalized(summaries).map((s) => s.quarter)),
  ].sort((a, b) => a.localeCompare(b));

  const acc = new Map<
    string,
    { title: string; section: string; scores: number[] }
  >();

  for (const quarter of quarters) {
    const inQuarter = finalized(summaries).filter((s) => s.quarter === quarter);
    const perArea = new Map<string, { title: string; section: string; sum: number; n: number }>();
    for (const s of inQuarter) {
      for (const ss of s.subSections) {
        if (ss.code === null || ss.score === null) continue;
        const cur = perArea.get(ss.code) ?? {
          title: ss.title ?? ss.code,
          section: ss.section,
          sum: 0,
          n: 0,
        };
        cur.sum += ss.score;
        cur.n += 1;
        perArea.set(ss.code, cur);
      }
    }
    for (const [code, v] of perArea) {
      const cur = acc.get(code) ?? { title: v.title, section: v.section, scores: [] };
      cur.scores.push(round(v.sum / v.n));
      acc.set(code, cur);
    }
  }

  return [...acc.entries()]
    .filter(([, v]) => v.scores.length > 0)
    .map(([code, v]) => {
    const latest = v.scores[v.scores.length - 1]!;
    const earliest = v.scores[0]!;
    const change = v.scores.length >= 2 ? round(latest - earliest) : null;
    const direction: AreaDirection =
      change === null || Math.abs(change) < FLAT_BAND
        ? "flat"
        : change > 0
          ? "improving"
          : "declining";
    return {
      code,
      title: v.title,
      section: v.section,
      scores: v.scores,
      reviews: v.scores.length,
      latest,
      average: round(v.scores.reduce((sum, n) => sum + n, 0) / v.scores.length),
      change,
      direction,
      gap: gapToTarget(latest),
    };
  });
}

/**
 * Areas the director should act on: below target and not improving, worst
 * gap first. A big gap that is already improving ranks below a smaller gap
 * that has been stuck for several reviews.
 */
export function focusAreas(trends: AreaTrend[], limit: number): AreaTrend[] {
  return trends
    .filter((t) => t.latest < TARGET_SCORE && t.direction !== "improving")
    .sort(
      (a, b) =>
        b.gap! - a.gap! ||
        b.reviews - a.reviews ||
        a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

/**
 * What is going well and should be held: at or above target, or clearly
 * improving. Best first.
 */
export function strengthAreas(trends: AreaTrend[], limit: number): AreaTrend[] {
  return trends
    .filter((t) => t.latest >= TARGET_SCORE || t.direction === "improving")
    .sort(
      (a, b) =>
        b.latest - a.latest ||
        (b.change ?? 0) - (a.change ?? 0) ||
        a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Trends over quarters                                                */
/* ------------------------------------------------------------------ */

/** Observation counts per classification per quarter — "are documentation
 * gaps rising while implementation gaps fall?" */
export function observationTrendByQuarter(
  rows: ObservationRow[],
): { quarters: string[]; series: Array<{ code: ObservationCode; values: number[] }> } {
  const quarters = [...new Set(rows.map((r) => r.quarter))].sort((a, b) =>
    a.localeCompare(b),
  );
  const codes: ObservationCode[] = ["OB2", "OB3", "OB4", "OB5"];
  const series = codes.map((code) => ({
    code,
    values: quarters.map(
      (q) =>
        rows.filter((r) => r.quarter === q && r.observation === code).length,
    ),
  }));
  return { quarters, series };
}

export interface ContractorSeries {
  contractorId: string;
  label: string;
  /** Score per quarter, aligned to the shared quarter axis; null = no review. */
  values: Array<number | null>;
}

/** One score series per contractor on a shared quarter axis. */
export function contractorSeriesByQuarter(
  summaries: AuditSummary[],
): { quarters: string[]; series: ContractorSeries[] } {
  const rows = finalized(summaries);
  const quarters = [...new Set(rows.map((s) => s.quarter))].sort((a, b) =>
    a.localeCompare(b),
  );
  const byContractor = new Map<string, AuditSummary[]>();
  for (const s of rows) {
    const list = byContractor.get(s.contractorId) ?? [];
    list.push(s);
    byContractor.set(s.contractorId, list);
  }
  const series = [...byContractor.entries()].map(([contractorId, list]) => ({
    contractorId,
    label: `${list[0]!.contractorName} (${list[0]!.contractorCode})`,
    values: quarters.map(
      (q) => list.find((s) => s.quarter === q)?.overall ?? null,
    ),
  }));
  return { quarters, series };
}

/* ------------------------------------------------------------------ */
/* SHEW domains                                                        */
/* ------------------------------------------------------------------ */

export interface DomainCount {
  domain: DomainId;
  label: string;
  count: number;
  share: number;
}

/** Findings grouped by SHEW pillar, most first. */
export function domainBreakdown(rows: ObservationRow[]): DomainCount[] {
  const counts = new Map<DomainId, number>();
  for (const r of rows) counts.set(r.domain, (counts.get(r.domain) ?? 0) + 1);
  const total = rows.length;
  return DOMAINS.filter((d) => (counts.get(d.id) ?? 0) > 0)
    .map((d) => ({
      domain: d.id,
      label: d.label,
      count: counts.get(d.id)!,
      share: total ? round((counts.get(d.id)! / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export interface DomainGapCell {
  domain: DomainId;
  observation: ObservationCode;
  count: number;
}

export interface DomainGapMatrix {
  domains: Array<{ id: DomainId; label: string; total: number }>;
  observations: ObservationCode[];
  cells: DomainGapCell[];
  max: number;
  total: number;
}

/**
 * The cross-tab that says where to aim: SHEW pillar against the kind of gap.
 * "Safety × implementation" means the rules exist and are not being followed
 * on site; "Health × documentation" is a paperwork problem. They need
 * completely different interventions.
 */
export function domainGapMatrix(rows: ObservationRow[]): DomainGapMatrix {
  const observations: ObservationCode[] = ["OB2", "OB3", "OB4", "OB5"];
  const present = DOMAINS.filter((d) =>
    rows.some((r) => r.domain === d.id),
  );
  const cells: DomainGapCell[] = [];
  let max = 0;
  for (const d of present) {
    for (const o of observations) {
      const count = rows.filter(
        (r) => r.domain === d.id && r.observation === o,
      ).length;
      if (count > max) max = count;
      cells.push({ domain: d.id, observation: o, count });
    }
  }
  return {
    domains: present.map((d) => ({
      id: d.id,
      label: d.label,
      total: rows.filter((r) => r.domain === d.id).length,
    })),
    observations,
    cells,
    max,
    total: rows.length,
  };
}

/** One hazardous-work item across the reviews in scope. */
export interface CriticalRiskStat {
  id: CriticalRiskId;
  label: string;
  domain: DomainId;
  /** Mean score across the reviews where the hazard was in scope. */
  avg: number | null;
  /** How far the mean sits below the 90% target (0 when at or above). */
  gap: number | null;
  /** Reviews that scored this hazard. */
  reviews: number;
  /** Distinct contractors carrying the hazard in scope. */
  contractors: number;
  /** Contractors scoring below target on it, worst first. */
  belowTarget: Array<{ contractorId: string; label: string; score: number }>;
}

/**
 * Critical Risk Control performance per hazard across a set of reviews.
 * Hazards outside every contractor's scope drop out entirely rather than
 * appearing as zero, and the list is ranked worst-first so the focus audits
 * to book next are at the top.
 *
 * `belowTarget` collapses to one row per contractor (its mean on that
 * hazard), so a contractor audited four quarters is named once.
 */
export function criticalRiskStats(
  summaries: AuditSummary[],
): CriticalRiskStat[] {
  const scored = finalized(summaries);

  return CRITICAL_RISKS.map((risk) => {
    const byContractor = new Map<string, { label: string; values: number[] }>();
    const values: number[] = [];

    for (const s of scored) {
      const value = s.criticalRisks[risk.id];
      if (value === undefined) continue;
      values.push(value);
      const entry = byContractor.get(s.contractorId) ?? {
        label: `${s.contractorName} (${s.contractorCode})`,
        values: [],
      };
      entry.values.push(value);
      byContractor.set(s.contractorId, entry);
    }

    const avg =
      values.length === 0
        ? null
        : round(values.reduce((sum, v) => sum + v, 0) / values.length);

    const belowTarget = [...byContractor.entries()]
      .map(([contractorId, { label, values: v }]) => ({
        contractorId,
        label,
        score: round(v.reduce((sum, x) => sum + x, 0) / v.length),
      }))
      .filter((c) => c.score < TARGET_SCORE)
      .sort((a, b) => a.score - b.score);

    return {
      id: risk.id,
      label: risk.label,
      domain: risk.domain,
      avg,
      gap: gapToTarget(avg),
      reviews: values.length,
      contractors: byContractor.size,
      belowTarget,
    };
  }).filter((r) => r.reviews > 0);
}

/** The hazards most in need of attention: lowest mean first. */
export function weakestCriticalRisks(
  summaries: AuditSummary[],
  limit: number,
): CriticalRiskStat[] {
  return criticalRiskStats(summaries)
    .filter((r) => r.avg !== null)
    .sort((a, b) => a.avg! - b.avg!)
    .slice(0, limit);
}
