/**
 * Derived, serializable views over the audit data — pure functions shared by
 * the dashboard, contractor pages and findings register (no server imports).
 */

import { CHECKLIST } from "./checklist";
import {
  flattenChecklist,
  scoreAudit,
  scoreRecordedAreas,
  type AuditScore,
} from "./scoring";
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
  type EhssAnswer,
  type EhssAudit,
  type EhssContractor,
  type SubRegion,
} from "./model";
import { GAP_CATEGORIES, type IssueCode } from "./issues";

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
  /** The total the source sheet stated, for an imported audit that had one.
   * Shown beside the computed total, never instead of it. */
  reportedTotal: number | null;
  /** True when this audit was recorded as area points rather than answers,
   * so nothing question-level (findings, causes, recurrence) exists for it. */
  fromAreaScores: boolean;
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
  /** Every category the auditor chose; at least one on a gap. */
  issues: IssueCode[];
}

const FLAT = flattenChecklist(CHECKLIST);
/** Scores round to 2 decimals everywhere, matching the scoring engine —
 * so a single-review window reports exactly that review's total. */
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * The Health & Safety checklist score for an audit, however it was recorded:
 * from its answers, or from the area points of an audit imported from a
 * sheet. One definition, so a page cannot read an imported audit as unscored.
 */
export function scoreChecklist(audit: EhssAudit): AuditScore {
  return audit.areaScores
    ? scoreRecordedAreas(CHECKLIST, audit.areaScores)
    : scoreAudit(CHECKLIST, audit.responses);
}

export function summarizeAudit(
  audit: EhssAudit,
  contractor: EhssContractor,
  subRegion: SubRegion,
): AuditSummary {
  // An audit imported from a sheet holds area points and no answers; it
  // scores through the same aggregation, one level coarser.
  const fromAreaScores = audit.areaScores !== undefined;
  const score = scoreChecklist(audit);
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
    reportedTotal: audit.reportedTotal ?? null,
    fromAreaScores,
    rating: ratingFor(overall),
    sections: score.sections.map((s) => ({
      code: s.code,
      title: s.title,
      score: s.score,
    })),
    // Section A's questions sit directly in the section, so its sub-section
    // is unnamed. It is still a checklist AREA — the largest one — so it
    // takes the section's own code and title here, which keeps `subSections`
    // aligned with `checklistAreas()` and stops area A dropping out of the
    // trends and the drill-down.
    subSections: score.sections.flatMap((s) =>
      s.subSections.map((ss) => ({
        section: s.code,
        code: ss.code ?? s.code,
        title: ss.title ?? s.title,
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
    const sorted = list.sort(
      (a, b) =>
        a.quarter.localeCompare(b.quarter) ||
        // A contractor can be audited twice in one quarter, so the quarter
        // alone does not order the window.
        a.auditDate.localeCompare(b.auditDate),
    );
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
    shortName: string;
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
        shortName: d.shortName,
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
      if (r.issues.length === 0) continue;
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
        issues: r.issues,
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
  /** The category most often cited for this question. */
  topIssue: IssueCode | null;
}

/**
 * The questions costing the most score across the given audits, ranked by
 * weighted points lost (a weight-4 "No" outranks a weight-1 "Partial").
 */
export function topIssues(audits: EhssAudit[], limit: number): IssueRow[] {
  const acc = new Map<
    string,
    Omit<IssueRow, "topIssue"> & { obs: Map<IssueCode, number> }
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
          obs: new Map<IssueCode, number>(),
        };
      cur.occurrences += 1;
      if (r.answer === "no") cur.noCount += 1;
      else cur.partialCount += 1;
      cur.lostPoints +=
        item.question.weight * (1 - ANSWER_VALUE[r.answer]);
      for (const code of r.issues) {
        cur.obs.set(code, (cur.obs.get(code) ?? 0) + 1);
      }
      acc.set(item.question.code, cur);
    }
  }

  return [...acc.values()]
    .map(({ obs, ...rest }) => ({
      ...rest,
      lostPoints: round(rest.lostPoints),
      topIssue:
        [...obs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort(
      (a, b) => b.lostPoints - a.lostPoints || b.occurrences - a.occurrences,
    )
    .slice(0, limit);
}

/**
 * Findings grouped by issue category, most frequent first.
 *
 * A finding with three categories counts once under each, so the counts sum
 * to MORE than the number of findings. `share` is therefore the share of
 * findings carrying that category, not a slice of a pie — every caller that
 * displays it has to say so.
 */
export function issueBreakdown(
  rows: ObservationRow[],
): Array<{ code: IssueCode; count: number; share: number }> {
  const counts = new Map<IssueCode, number>();
  for (const r of rows)
    for (const code of r.issues)
      counts.set(code, (counts.get(code) ?? 0) + 1);
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



/* ------------------------------------------------------------------ */
/* Trends over quarters                                                */
/* ------------------------------------------------------------------ */

/** Observation counts per classification per quarter — "are documentation
 * gaps rising while implementation gaps fall?" */
export function issueTrendByQuarter(
  rows: ObservationRow[],
  limit = GAP_CATEGORIES.length,
): { quarters: string[]; series: Array<{ code: IssueCode; values: number[] }> } {
  const quarters = [...new Set(rows.map((r) => r.quarter))].sort((a, b) =>
    a.localeCompare(b),
  );
  // All twelve by default: the consumer draws small multiples, which have
  // no series-count ceiling, and trimming to "the top N" would make the set
  // shift under a filter — the thing that ruled out a single line chart.
  const ranked = issueBreakdown(rows).slice(0, limit).map((b) => b.code);
  const codes: IssueCode[] = GAP_CATEGORIES.filter((c) =>
    ranked.includes(c.code),
  ).map((c) => c.code);
  const series = codes.map((code) => ({
    code,
    values: quarters.map(
      (q) =>
        rows.filter((r) => r.quarter === q && r.issues.includes(code)).length,
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
  issue: IssueCode;
  count: number;
}

export interface DomainGapMatrix {
  domains: Array<{ id: DomainId; label: string; total: number }>;
  issues: IssueCode[];
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
/**
 * SHEW pillar × issue category.
 *
 * A finding with three categories appears in three cells, so the cells sum
 * to more than `total` — `total` and each `domains[].total` count FINDINGS,
 * the cells count category tags. The card says so; do not "fix" the cells
 * to sum to the total, because that would mean dropping a cause the auditor
 * actually recorded.
 */
export function domainGapMatrix(rows: ObservationRow[]): DomainGapMatrix {
  const issues: IssueCode[] = GAP_CATEGORIES.map((c) => c.code);
  const present = DOMAINS.filter((d) =>
    rows.some((r) => r.domain === d.id),
  );
  const cells: DomainGapCell[] = [];
  let max = 0;
  for (const d of present) {
    for (const o of issues) {
      const count = rows.filter(
        (r) => r.domain === d.id && r.issues.includes(o),
      ).length;
      if (count > max) max = count;
      cells.push({ domain: d.id, issue: o, count });
    }
  }
  return {
    domains: present.map((d) => ({
      id: d.id,
      label: d.label,
      total: rows.filter((r) => r.domain === d.id).length,
    })),
    issues,
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

/* ------------------------------------------------------------------ *
 * Problems — the drill-down model
 *
 * The dashboard is one chart; everything else is reached by drilling into
 * it. A "problem" is one concrete thing a contractor is failing at, stated
 * in a few words and ranked so the worst is first. Disciplines are NOT
 * problems — they are the structure a problem sits in, shown alongside.
 * ------------------------------------------------------------------ */

export type ProblemKind = "area" | "hazard" | "question";

export interface ProblemRow {
  /** Stable key, unique across kinds. */
  id: string;
  kind: ProblemKind;
  /** Code as the auditor knows it: "B6", "height", "A1". */
  code: string;
  label: string;
  /**
   * Latest score, 0-100. A question has an answer rather than a figure, but
   * the engine already scores it (Full 100, Partial 50, No 0), so that is
   * what it carries — every problem row then reads the same way: how
   * compliant, against the same target. Null only when nothing is scored.
   */
  score: number | null;
  /** Points below the 90% target. */
  gap: number;
  direction: AreaDirection | null;
  /** Reviews the judgement rests on. */
  reviews: number;
  /** One short line. Never a sentence — this is read at a glance. */
  note: string;
  /** Consecutive reviews open. Only tracked for questions, where the
   * answer is recorded review by review; 0 for areas and hazards, whose
   * `note` already carries their movement. */
  streak: number;
  /** Closed at some point and open again — the fix did not hold. */
  reopened: boolean;
  /** Ranking weight: the gap, amplified when it is not getting better. */
  severity: number;
  /**
   * Score across the quarters in the window, oldest first — what the row's
   * sparkline draws. A question has answers rather than a score, so its
   * answers are mapped onto the same 0-100 scale the checklist uses
   * (Full 100, Partial 50, No 0) and N/A is skipped: it is the trajectory
   * that matters here, not a score anyone would quote.
   */
  series: number[];
  /** Quarter labels matching `series`. */
  quarters: string[];
}

const TREND_WEIGHT: Record<AreaDirection, number> = {
  declining: 1.6,
  flat: 1.25,
  improving: 1,
};

/** "no change in 4 reviews" / "down 6.2 pts" / "first review". */
function trendNote(
  direction: AreaDirection | null,
  change: number | null,
  reviews: number,
): string {
  if (reviews < 2 || direction === null) return "first review";
  if (direction === "flat") return `no change in ${reviews} reviews`;
  const verb = direction === "declining" ? "down" : "up";
  return `${verb} ${Math.abs(change ?? 0).toFixed(1)} pts`;
}

/**
 * Everything this contractor is failing at, worst first.
 *
 * Three sources, one ranking: checklist sub-sections below target, critical
 * risk hazards below target, and questions answered No often enough to
 * matter on their own. Ranked by gap to target, amplified when the trend is
 * flat or declining — a 15-point gap that is closing is a smaller problem
 * than a 12-point gap that has not moved in a year, and that is the whole
 * point of tracking quarters.
 */
export function contractorProblems(
  summaries: AuditSummary[],
  audits: EhssAudit[],
  limit = 6,
): ProblemRow[] {
  const scored = finalized(summaries);
  const rows: ProblemRow[] = [];
  // areaTrends gives scores per quarter but not their labels; they are the
  // window's quarters in order, which is what the sparklines label with.
  const areaQuarters = [...new Set(scored.map((s) => s.quarter))].sort();

  // 1. Checklist sub-sections below target.
  for (const area of areaTrends(scored)) {
    if (area.gap === null || area.gap <= 0) continue;
    rows.push({
      id: `area:${area.code}`,
      kind: "area",
      code: area.code,
      label: area.title,
      score: area.latest,
      gap: area.gap,
      direction: area.reviews < 2 ? null : area.direction,
      reviews: area.reviews,
      note: trendNote(
        area.reviews < 2 ? null : area.direction,
        area.change,
        area.reviews,
      ),
      streak: 0,
      reopened: false,
      severity:
        area.gap *
        (area.reviews < 2 ? 1 : TREND_WEIGHT[area.direction]),
      series: area.scores,
      quarters: areaQuarters,
    });
  }

  // 2. Critical-risk hazards below target, from this contractor's own scope.
  for (const risk of CRITICAL_RISKS) {
    const series = scored
      .map((s) => s.criticalRisks[risk.id])
      .filter((v): v is number => v !== undefined);
    if (series.length === 0) continue;
    const latest = series[series.length - 1]!;
    const gap = gapToTarget(latest);
    if (gap === null || gap <= 0) continue;
    const change = series.length < 2 ? null : round(latest - series[0]!);
    const direction: AreaDirection | null =
      change === null
        ? null
        : change > 1
          ? "improving"
          : change < -1
            ? "declining"
            : "flat";
    rows.push({
      id: `hazard:${risk.id}`,
      kind: "hazard",
      code: risk.id,
      label: risk.label,
      score: latest,
      gap,
      direction,
      reviews: series.length,
      note: trendNote(direction, change, series.length),
      streak: 0,
      reopened: false,
      severity: gap * (direction === null ? 1 : TREND_WEIGHT[direction]),
      series,
      quarters: scored
        .filter((s) => s.criticalRisks[risk.id] !== undefined)
        .map((s) => s.quarter),
    });
  }

  // 3. Individual questions costing real points — only those answered No,
  //    weighted up when the same answer keeps coming back. A question open
  //    four reviews running outranks a worse one seen only once: the first
  //    is a management failure, the second is a finding.
  const byQuestion = new Map(
    findingHistories(summaries, audits).map((h) => [h.questionCode, h]),
  );
  for (const issue of topIssues(audits, 8)) {
    if (issue.noCount === 0) continue;
    const history = byQuestion.get(issue.questionCode);
    const streak = history?.openStreak ?? 0;
    const reopened = history?.status === "reopened";
    const recurring = history?.status === "recurring";
    const answered = (history?.timeline ?? []).filter((t) => t.answer !== "na");
    const last = answered[answered.length - 1];
    rows.push({
      id: `question:${issue.questionCode}`,
      kind: "question",
      code: issue.questionCode,
      label: issue.questionText,
      score:
        last === undefined
          ? null
          : ANSWER_VALUE[last.answer as "full" | "partial" | "no"] * 100,
      gap: issue.lostPoints,
      direction: null,
      reviews: issue.occurrences,
      note: reopened
        ? "closed, then came back"
        : recurring
          ? `open ${streak} reviews running`
          : issue.occurrences === 1
            ? "1 review"
            : `${issue.noCount} of ${issue.occurrences} reviews: No`,
      streak,
      reopened,
      severity:
        issue.lostPoints * (reopened ? 1.8 : recurring ? 1.5 : 1.1),
      series: (history?.timeline ?? [])
        .filter((t) => t.answer !== "na")
        .map((t) => ANSWER_VALUE[t.answer as "full" | "partial" | "no"] * 100),
      quarters: (history?.timeline ?? [])
        .filter((t) => t.answer !== "na")
        .map((t) => t.quarter),
    });
  }

  return rows.sort((a, b) => b.severity - a.severity).slice(0, limit);
}

/** One row of evidence behind a problem: what was answered, and when. */
export interface EvidenceRow {
  quarter: string;
  /** Question code, or the hazard/area label for a score series. */
  code: string;
  text: string;
  /** Percentage for a score series, null for an answer row. */
  score: number | null;
  answer: "partial" | "no" | null;
  issues: IssueCode[];
  weight: number | null;
}

/**
 * The evidence behind one problem — what the auditor actually recorded.
 *
 * For an area: every Partial or No answer inside that sub-section, newest
 * first. For a hazard: its score each quarter. For a question: how it was
 * answered each quarter. This is the bottom of the drill-down: below this
 * there is only the audit itself.
 */
export function problemEvidence(
  problem: ProblemRow,
  summaries: AuditSummary[],
  audits: EhssAudit[],
  limit = 8,
): EvidenceRow[] {
  const scored = finalized(summaries);
  const byId = new Map(audits.map((a) => [a.id, a]));
  const flat = flattenChecklist(CHECKLIST);

  if (problem.kind === "hazard") {
    return scored
      .map((s) => ({
        quarter: s.quarter,
        code: problem.code,
        text: problem.label,
        score: s.criticalRisks[problem.code as CriticalRiskId] ?? null,
        answer: null,
        issues: [],
        weight: null,
      }))
      .filter((r) => r.score !== null)
      .reverse()
      .slice(0, limit);
  }

  // Both remaining kinds read the checklist answers.
  const inScope = (code: string) =>
    problem.kind === "question"
      ? code === problem.code
      : flat.some(
          (f) => f.question.code === code && f.subSection === problem.code,
        );

  const rows: EvidenceRow[] = [];
  for (const summary of [...scored].reverse()) {
    const audit = byId.get(summary.id);
    if (!audit) continue;
    for (const { question } of flat) {
      if (!inScope(question.code)) continue;
      const response = audit.responses[question.code];
      if (!response) continue;
      if (response.answer !== "partial" && response.answer !== "no") continue;
      rows.push({
        quarter: summary.quarter,
        code: question.code,
        text: question.text,
        score: null,
        answer: response.answer,
        issues: response.issues,
        weight: question.weight,
      });
      if (rows.length >= limit) return rows;
    }
  }
  return rows;
}

/** How a contractor's problem compares with the rest of the programme. */
export interface ProblemPeer {
  label: string;
  /** The programme figure: a mean score, or a count of contractors. */
  value: number;
  suffix: string;
  /** This contractor minus the programme, for scores. Null for counts. */
  delta: number | null;
}

/**
 * The benchmark for one problem across every contractor in scope.
 *
 * "We score 71% on Working at Height" means something different when the
 * programme averages 88% than when it averages 72% — the first is a
 * contractor problem, the second is a programme problem, and they get
 * fixed by different people.
 */
export function problemPeer(
  problem: ProblemRow,
  allSummaries: AuditSummary[],
  allAudits: EhssAudit[],
): ProblemPeer | null {
  const scored = finalized(allSummaries);
  if (scored.length === 0) return null;

  if (problem.kind === "hazard") {
    const values = scored
      .map((s) => s.criticalRisks[problem.code as CriticalRiskId])
      .filter((v): v is number => v !== undefined);
    if (values.length === 0) return null;
    const mean = round(values.reduce((sum, v) => sum + v, 0) / values.length);
    return {
      label: "Programme average",
      value: mean,
      suffix: "%",
      delta: problem.score === null ? null : round(problem.score - mean),
    };
  }

  if (problem.kind === "area") {
    const values = scored
      .flatMap((s) => s.subSections)
      .filter((ss) => ss.code === problem.code && ss.score !== null)
      .map((ss) => ss.score!);
    if (values.length === 0) return null;
    const mean = round(values.reduce((sum, v) => sum + v, 0) / values.length);
    return {
      label: "Programme average",
      value: mean,
      suffix: "%",
      delta: problem.score === null ? null : round(problem.score - mean),
    };
  }

  // A question: how widely shared the failure is.
  const contractorsFailing = new Set(
    allAudits
      .filter((a) => {
        const r = a.responses[problem.code];
        return r && (r.answer === "partial" || r.answer === "no");
      })
      .map((a) => a.contractorId),
  ).size;
  const total = new Set(scored.map((s) => s.contractorId)).size;
  if (total === 0) return null;
  return {
    label: "Contractors with the same gap",
    value: contractorsFailing,
    suffix: ` of ${total}`,
    delta: null,
  };
}

/* ------------------------------------------------------------------ *
 * Finding histories — what keeps coming back, and what got fixed
 *
 * A quarterly audit is only worth running if you can see across the
 * quarters. One Partial is a finding; the same Partial three reviews
 * running is a management failure, and the two should not look alike on
 * screen. The positive side matters just as much: a finding that closed
 * is the evidence that the follow-up worked.
 * ------------------------------------------------------------------ */

/** Consecutive open reviews before a finding counts as recurring. */
export const RECURRING_THRESHOLD = 3;

export type FindingStatus =
  /** Open in the latest review, and in RECURRING_THRESHOLD or more in a row. */
  | "recurring"
  /** Was closed at some point, and is open again now. */
  | "reopened"
  /** Open in the latest review, but not yet long enough to be recurring. */
  | "open"
  /** Was open, answered Full in the latest review. */
  | "closed";

export interface FindingTimelineEntry {
  quarter: string;
  answer: EhssAnswer;
  issues: IssueCode[];
}

export interface FindingHistory {
  /** contractorId + question code. */
  id: string;
  contractorId: string;
  contractorName: string;
  contractorCode: string;
  subRegionId: string;
  questionCode: string;
  questionText: string;
  subSectionCode: string | null;
  subSectionTitle: string | null;
  sectionCode: string;
  domain: DomainId;
  weight: number;
  /** Oldest first, one entry per finalized review that answered the question. */
  timeline: FindingTimelineEntry[];
  status: FindingStatus;
  /** Consecutive reviews open, counting back from the latest. */
  openStreak: number;
  /** True when a Full answer sits between two open ones. */
  reopened: boolean;
  /** Quarter it closed in, for a closed finding. */
  closedIn: string | null;
  /** Where an open finding is heading: No->Partial is real progress. */
  trajectory: "improving" | "worsening" | "same" | null;
  /** Ranking weight: streak and question weight, reopened counts double. */
  severity: number;
}

const isOpen = (a: EhssAnswer) => a === "partial" || a === "no";

/**
 * Per-contractor history of every question that was ever a finding.
 *
 * N/A is deliberately NOT treated as a closure. "Not applicable this
 * quarter" is not evidence that anything was fixed — it usually means the
 * work was not running — so an N/A breaks the streak without earning the
 * contractor a closed finding. Only a Full answer closes one.
 *
 * Questions that were never open are omitted entirely: this is a view of
 * findings, not of the checklist.
 */
export function findingHistories(
  summaries: AuditSummary[],
  audits: EhssAudit[],
): FindingHistory[] {
  const byId = new Map(audits.map((a) => [a.id, a]));
  const flat = flattenChecklist(CHECKLIST);
  const out: FindingHistory[] = [];

  // Group reviews by contractor, oldest first — each contractor has its own
  // timeline, so a mixed-scope list cannot be read as one sequence.
  const byContractor = new Map<string, AuditSummary[]>();
  for (const s of finalized(summaries)) {
    const list = byContractor.get(s.contractorId) ?? [];
    list.push(s);
    byContractor.set(s.contractorId, list);
  }

  for (const [contractorId, reviews] of byContractor) {
    reviews.sort((a, b) => a.quarter.localeCompare(b.quarter));
    const head = reviews[0]!;

    for (const { question, section, subSection, subSectionTitle } of flat) {
      const timeline: FindingTimelineEntry[] = [];
      for (const review of reviews) {
        const audit = byId.get(review.id);
        const response = audit?.responses[question.code];
        if (!response) continue;
        timeline.push({
          quarter: review.quarter,
          answer: response.answer,
          issues: response.issues,
        });
      }
      if (timeline.length === 0) continue;
      if (!timeline.some((t) => isOpen(t.answer))) continue; // never a finding

      const latest = timeline[timeline.length - 1]!;

      // A Full answer that comes after an open one closed it at least once.
      const firstOpen = timeline.findIndex((t) => isOpen(t.answer));
      const closedAfterOpen = timeline
        .slice(firstOpen + 1)
        .some((t) => t.answer === "full");

      let openStreak = 0;
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (!isOpen(timeline[i]!.answer)) break;
        openStreak++;
      }

      let status: FindingStatus;
      let closedIn: string | null = null;
      if (latest.answer === "full") {
        status = "closed";
        closedIn = latest.quarter;
      } else if (!isOpen(latest.answer)) {
        // Latest is N/A: not assessed, so neither closed nor open. The
        // finding keeps whatever it last was, which is "open".
        status = "open";
      } else if (closedAfterOpen) {
        status = "reopened";
      } else if (openStreak >= RECURRING_THRESHOLD) {
        status = "recurring";
      } else {
        status = "open";
      }

      // Direction for an open finding, across the open run only.
      let trajectory: FindingHistory["trajectory"] = null;
      if (status !== "closed" && openStreak >= 2) {
        const run = timeline.slice(timeline.length - openStreak);
        const first = run[0]!.answer;
        const last = run[run.length - 1]!.answer;
        trajectory =
          first === last
            ? "same"
            : first === "no" && last === "partial"
              ? "improving"
              : "worsening";
      }

      const severity =
        status === "closed"
          ? 0
          : question.weight * openStreak * (status === "reopened" ? 2 : 1);

      out.push({
        id: `${contractorId}:${question.code}`,
        contractorId,
        contractorName: head.contractorName,
        contractorCode: head.contractorCode,
        subRegionId: head.subRegionId,
        questionCode: question.code,
        questionText: question.text,
        subSectionCode: subSection,
        subSectionTitle,
        sectionCode: section,
        domain: question.domain,
        weight: question.weight,
        timeline,
        status,
        openStreak,
        reopened: closedAfterOpen && isOpen(latest.answer),
        closedIn,
        trajectory,
        severity,
      });
    }
  }

  return out;
}

/** Findings that will not go away: recurring or reopened, worst first. */
export function recurringFindings(
  histories: FindingHistory[],
  limit?: number,
): FindingHistory[] {
  const rows = histories
    .filter((h) => h.status === "recurring" || h.status === "reopened")
    .sort(
      (a, b) =>
        b.severity - a.severity ||
        a.contractorName.localeCompare(b.contractorName),
    );
  return limit === undefined ? rows : rows.slice(0, limit);
}

/**
 * Findings closed in the most recent review — the evidence that follow-up
 * worked, which is the half of the story an audit report usually drops.
 */
export function closedFindings(
  histories: FindingHistory[],
  limit?: number,
): FindingHistory[] {
  const latestByContractor = new Map<string, string>();
  for (const h of histories) {
    const last = h.timeline[h.timeline.length - 1]!.quarter;
    const seen = latestByContractor.get(h.contractorId);
    if (!seen || last.localeCompare(seen) > 0) {
      latestByContractor.set(h.contractorId, last);
    }
  }
  const rows = histories
    .filter(
      (h) =>
        h.status === "closed" &&
        h.closedIn === latestByContractor.get(h.contractorId),
    )
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        a.contractorName.localeCompare(b.contractorName),
    );
  return limit === undefined ? rows : rows.slice(0, limit);
}

/** Headline counts for a scope: what is stuck, and what moved. */
export interface FindingMovement {
  recurring: number;
  reopened: number;
  closedLatest: number;
  improving: number;
}

export function findingMovement(
  histories: FindingHistory[],
): FindingMovement {
  return {
    recurring: histories.filter((h) => h.status === "recurring").length,
    reopened: histories.filter((h) => h.status === "reopened").length,
    closedLatest: closedFindings(histories).length,
    improving: histories.filter(
      (h) => h.status !== "closed" && h.trajectory === "improving",
    ).length,
  };
}

/* ------------------------------------------------------------------ *
 * Checklist analysis — the H&S checklist read across contractors
 *
 * The 81 questions are the only part of the scorecard with real depth, and
 * the question a programme manager asks of them is not "how is this
 * contractor doing" but "is this OUR problem or THEIRS". A control nine of
 * eleven contractors fail is a programme failure — one briefing fixes it
 * everywhere. A control one contractor fails is that contractor's.
 * ------------------------------------------------------------------ */

/** A scoreable area of the checklist: section A as a whole, then each
 * sub-section. Section A's questions sit directly in it (no sub-section),
 * so it is its own area rather than being dropped. */
export interface ChecklistArea {
  code: string; // "A", "B6", "C1"
  title: string;
  section: string;
  questionCount: number;
}

export function checklistAreas(): ChecklistArea[] {
  const out: ChecklistArea[] = [];
  for (const section of CHECKLIST) {
    const bare = section.subSections.filter((ss) => ss.code === null);
    if (bare.length > 0) {
      out.push({
        code: section.code,
        title: section.title,
        section: section.code,
        questionCount: bare.reduce((n, ss) => n + ss.questions.length, 0),
      });
    }
    for (const ss of section.subSections) {
      if (ss.code === null) continue;
      out.push({
        code: ss.code,
        title: ss.title ?? ss.code,
        section: section.code,
        questionCount: ss.questions.length,
      });
    }
  }
  return out;
}

export interface AreaCell {
  contractorId: string;
  /** "Al Fahd (1272)" — for tooltips and prose. */
  label: string;
  /** Kept apart as well, because three contractors are called Al Fahd and a
   * narrow matrix column can only show one of the two. */
  name: string;
  code: string;
  score: number | null;
}

export interface ChecklistAreaStat extends ChecklistArea {
  /** Programme mean across the contractors that scored the area. */
  avg: number | null;
  /** Contractors scored on it, and how many sit below target. */
  contractors: number;
  belowTarget: number;
  /** One cell per contractor, in the order given. */
  cells: AreaCell[];
}

/**
 * Contractor × checklist-area grid. Each cell is that contractor's mean
 * score for the area across the reviews in scope — the view that separates
 * "everyone is weak here" from "one contractor is weak here" at a glance.
 */
export function checklistMatrix(
  summaries: AuditSummary[],
): { areas: ChecklistAreaStat[]; contractors: AreaCell[] } {
  const scored = finalized(summaries);

  const byContractor = new Map<string, AuditSummary[]>();
  for (const s of scored) {
    const list = byContractor.get(s.contractorId) ?? [];
    list.push(s);
    byContractor.set(s.contractorId, list);
  }

  const roster: AreaCell[] = [...byContractor.entries()]
    .map(([contractorId, reviews]) => ({
      contractorId,
      label: `${reviews[0]!.contractorName} (${reviews[0]!.contractorCode})`,
      name: reviews[0]!.contractorName,
      code: reviews[0]!.contractorCode,
      score: null as number | null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const areas = checklistAreas().map((area) => {
    const cells: AreaCell[] = roster.map(({ contractorId, label, name, code }) => {
      const reviews = byContractor.get(contractorId) ?? [];
      const values = reviews
        .map((r) =>
          area.code === area.section
            ? (r.sections.find((s) => s.code === area.code)?.score ?? null)
            : (r.subSections.find((ss) => ss.code === area.code)?.score ??
              null),
        )
        .filter((v): v is number => v !== null);
      return {
        contractorId,
        label,
        name,
        code,
        score:
          values.length === 0
            ? null
            : round(values.reduce((sum, v) => sum + v, 0) / values.length),
      };
    });

    const values = cells
      .map((c) => c.score)
      .filter((v): v is number => v !== null);

    return {
      ...area,
      avg:
        values.length === 0
          ? null
          : round(values.reduce((sum, v) => sum + v, 0) / values.length),
      contractors: values.length,
      belowTarget: values.filter((v) => v < TARGET_SCORE).length,
      cells,
    };
  });

  return { areas, contractors: roster };
}

/** One checklist question, measured across every contractor in scope. */
export interface ChecklistQuestionStat {
  code: string;
  text: string;
  weight: number;
  domain: DomainId;
  section: string;
  areaCode: string;
  areaTitle: string;
  /** Contractors whose reviews answered it at all (N/A excluded). */
  contractors: number;
  /** Contractors that answered Partial or No at least once. */
  failing: number;
  /** Share of answering contractors that failed it, 0-1. The systemic
   * signal: high means the programme has the problem, not one company. */
  failRate: number;
  noCount: number;
  partialCount: number;
  /** Weighted points lost across every review in scope. */
  lostPoints: number;
  /** The category most often cited for this question. */
  topIssue: IssueCode | null;
}

/**
 * Per-question programme statistics, worst first.
 *
 * `failRate` counts CONTRACTORS, not answers: one contractor failing the
 * same question four quarters running is one contractor with a problem,
 * not four. Ranking on answers would make a single stubborn contractor
 * look like a programme-wide failure.
 */
export function checklistQuestionStats(
  summaries: AuditSummary[],
  audits: EhssAudit[],
  areaCode?: string,
): ChecklistQuestionStat[] {
  const ids = new Set(finalized(summaries).map((s) => s.id));
  const inScope = audits.filter((a) => ids.has(a.id));
  const flat = flattenChecklist(CHECKLIST);

  return flat
    .filter(({ section, subSection }) =>
      areaCode === undefined
        ? true
        : subSection === null
          ? section === areaCode
          : subSection === areaCode,
    )
    .map(({ question, section, subSection, subSectionTitle }) => {
      const answering = new Set<string>();
      const failingSet = new Set<string>();
      let noCount = 0;
      let partialCount = 0;
      let lost = 0;
      const categories = new Map<IssueCode, number>();

      for (const audit of inScope) {
        const response = audit.responses[question.code];
        if (!response || response.answer === "na") continue;
        answering.add(audit.contractorId);
        if (response.answer === "full") continue;
        failingSet.add(audit.contractorId);
        if (response.answer === "no") noCount++;
        else partialCount++;
        lost += question.weight * (1 - ANSWER_VALUE[response.answer]);
        for (const code of response.issues) {
          categories.set(code, (categories.get(code) ?? 0) + 1);
        }
      }

      const top = [...categories.entries()].sort((a, b) => b[1] - a[1])[0];

      return {
        code: question.code,
        text: question.text,
        weight: question.weight,
        domain: question.domain,
        section,
        areaCode: subSection ?? section,
        areaTitle: subSectionTitle ?? CHECKLIST.find((s) => s.code === section)!.title,
        contractors: answering.size,
        failing: failingSet.size,
        failRate:
          answering.size === 0 ? 0 : failingSet.size / answering.size,
        noCount,
        partialCount,
        lostPoints: round(lost),
        topIssue: top ? top[0] : null,
      };
    })
    .sort(
      (a, b) =>
        b.failRate - a.failRate ||
        b.lostPoints - a.lostPoints ||
        a.code.localeCompare(b.code),
    );
}

/** How a question is answered by each contractor, newest review first. */
export interface QuestionByContractor {
  contractorId: string;
  label: string;
  quarter: string;
  answer: EhssAnswer;
  issues: IssueCode[];
}

export function questionByContractor(
  questionCode: string,
  summaries: AuditSummary[],
  audits: EhssAudit[],
): QuestionByContractor[] {
  const byId = new Map(audits.map((a) => [a.id, a]));
  const latest = new Map<string, AuditSummary>();
  for (const s of finalized(summaries)) {
    const seen = latest.get(s.contractorId);
    if (!seen || s.quarter.localeCompare(seen.quarter) > 0) {
      latest.set(s.contractorId, s);
    }
  }

  const rows: QuestionByContractor[] = [];
  for (const [contractorId, summary] of latest) {
    const response = byId.get(summary.id)?.responses[questionCode];
    if (!response) continue;
    rows.push({
      contractorId,
      label: `${summary.contractorName} (${summary.contractorCode})`,
      quarter: summary.quarter,
      answer: response.answer,
      issues: response.issues,
    });
  }

  const rank: Record<EhssAnswer, number> = { no: 0, partial: 1, full: 2, na: 3 };
  return rows.sort(
    (a, b) => rank[a.answer] - rank[b.answer] || a.label.localeCompare(b.label),
  );
}
