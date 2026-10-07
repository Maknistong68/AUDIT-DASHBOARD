/**
 * SYNTHETIC FIXTURE — used by the tests, never by the app.
 *
 * The app runs on the real audits in recorded.ts, which hold area points and
 * no per-question answers. The question-level machinery — findings, issue
 * categories, per-question recurrence — still has to be tested, and that
 * needs a dataset with answers in it, which is this one: eleven contractors
 * over four quarters, generated deterministically from a per-audit quality
 * profile. One audit (Al Fahd 1272, 2026-Q3) is the source workbook's real
 * answer set, so its scores match the Excel exactly.
 *
 * Nothing in src/app may import this. It carries invented numbers, and a
 * number on a director's screen that nobody audited is worse than a blank.
 */

import { CHECKLIST, WORKBOOK_FIXTURE_ANSWERS } from "./checklist";
import { flattenChecklist } from "./scoring";
import type {
  EhssAnswer,
  EhssAudit,
  EhssContractor,
  EhssResponse,
  SubRegion,
} from "./model";
import { GAP_CATEGORIES, type IssueCode } from "./issues";
import type { DisciplineId, DisciplineScores } from "./disciplines";
import {
  CRITICAL_RISKS,
  type CriticalRiskId,
  type CriticalRiskScores,
} from "./critical-risks";

export const subRegions: SubRegion[] = [
  { id: "sr1", name: "Sub Region 1" },
  { id: "sr2", name: "Sub Region 2" },
];

export const contractors: EhssContractor[] = [
  // Sub Region 1
  { id: "ppco",  code: "1322", name: "PPCO",          subRegionId: "sr1", active: true },
  { id: "afh882", code: "0882", name: "Al Fahd",      subRegionId: "sr1", active: true },
  { id: "sibs",  code: "0838", name: "SIBS",          subRegionId: "sr1", active: true },
  { id: "abya",  code: "1112", name: "Abyatona",      subRegionId: "sr1", active: true },
  { id: "rpco",  code: "1440", name: "RPCO",          subRegionId: "sr1", active: true },
  { id: "tdp",   code: "892",  name: "TDP",           subRegionId: "sr1", active: true },
  { id: "thys",  code: "731",  name: "Thyssenkrupp",  subRegionId: "sr1", active: true },
  // Sub Region 2
  { id: "sarco", code: "0876", name: "Sarco Disa",    subRegionId: "sr2", active: true },
  { id: "afh1272", code: "1272", name: "Al Fahd",     subRegionId: "sr2", active: true },
  { id: "afh823", code: "823",  name: "Al Fahd",      subRegionId: "sr2", active: true },
  { id: "ech",   code: "1131", name: "ECH",           subRegionId: "sr2", active: true },
];

const FLAT = flattenChecklist(CHECKLIST);
const GAP_CODES: IssueCode[] = GAP_CATEGORIES.map((c) => c.code);

/** Deterministic pseudo-random in [0, 1) from a seed and index. */
function det(seed: number, i: number): number {
  const x = Math.sin(seed * 374761 + i * 668265) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * One to three categories per finding, drawn from the twelve.
 *
 * Real findings usually have more than one cause, so a demo where every
 * finding carries exactly one would make the multi-select look decorative
 * and understate every category's count. Stable per contractor-and-question
 * so the categories do not churn between quarters, which would break the
 * recurrence view the same way unsticky answers did.
 */
function gapIssues(seed: number, i: number): IssueCode[] {
  const first = GAP_CODES[Math.floor(det(seed + 7, i) * GAP_CODES.length)]!;
  const extra = det(seed + 23, i);
  const count = extra < 0.42 ? 1 : extra < 0.85 ? 2 : 3;
  const out = [first];
  for (let k = 1; k < count; k++) {
    const pick =
      GAP_CODES[Math.floor(det(seed + 31 * k, i) * GAP_CODES.length)]!;
    if (!out.includes(pick)) out.push(pick);
  }
  // Register order reads better than draw order in a table.
  return GAP_CODES.filter((c) => out.includes(c));
}

/**
 * Generate a full answer set. `quality` (0..1) steers the Full/Partial/No
 * mix, so the resulting total lands near quality×100 without being exact.
 *
 * Answers are STICKY across quarters: most of each draw comes from the
 * contractor-and-question pair and only a little from the quarter, so a
 * documentation gap stays a gap until the contractor's quality rises past
 * it. Drawing each quarter independently made every finding look reopened
 * the next quarter, which is not how audits behave and made the recurrence
 * view read as noise.
 */
function genResponses(
  base: number,
  qi: number,
  quality: number,
): Record<string, EhssResponse> {
  const pFull = Math.max(0, Math.min(1, quality * 1.35 - 0.35));
  const pPartial = Math.max(0.1, Math.min(1 - pFull, (1 - pFull) * 0.75));
  const responses: Record<string, EhssResponse> = {};
  FLAT.forEach(({ question }, i) => {
    // Whether a question applies is a property of the contractor's scope,
    // so it does not change from quarter to quarter.
    if (det(base + 3, i) < 0.06) {
      responses[question.code] = { answer: "na", issues: [] };
      return;
    }
    const r = 0.8 * det(base, i) + 0.2 * det(base + qi * 97, i);
    let answer: EhssAnswer;
    if (r < pFull) answer = "full";
    else if (r < pFull + pPartial) answer = "partial";
    else answer = "no";
    responses[question.code] = {
      answer,
      issues:
        answer === "full"
          ? det(base + 11, i) < 0.12
            ? ["GOOD"]
            : []
          : gapIssues(base, i),
    };
  });
  return responses;
}

/** The workbook's own audit, with observations assigned to its gaps. */
function workbookResponses(): Record<string, EhssResponse> {
  const responses: Record<string, EhssResponse> = {};
  FLAT.forEach(({ question }, i) => {
    const answer = WORKBOOK_FIXTURE_ANSWERS[question.code]!;
    responses[question.code] = {
      answer,
      issues:
        answer === "partial" || answer === "no" ? gapIssues(42, i) : [],
    };
  });
  return responses;
}

/** Partially answered draft (about half the checklist). */
function draftResponses(
  base: number,
  qi: number,
  quality: number,
): Record<string, EhssResponse> {
  const full = genResponses(base, qi, quality);
  const responses: Record<string, EhssResponse> = {};
  FLAT.forEach(({ question }, i) => {
    if (i < FLAT.length / 2) responses[question.code] = full[question.code]!;
  });
  return responses;
}

/** 2026-Q3 discipline scores, transcribed from the Oxagon master scorecard:
 * [Health & Safety, Critical Risk, Environment, Security, Worker Welfare].
 * Earlier quarters are derived from these with a per-contractor trend. */
const SCORECARD: Record<string, [number, number, number, number, number]> = {
  ppco:    [76, 81, 94, 89, 77],
  afh882:  [72, 81, 94, 86, 87],
  sibs:    [70, 85, 85, 68, 78],
  abya:    [63, 88, 89, 81, 75],
  rpco:    [70, 84, 95, 77, 82],
  tdp:     [75, 86, 78, 89, 77],
  thys:    [80, 92, 86, 89, 77],
  sarco:   [75, 95, 99, 97, 88],
  afh1272: [62, 89, 97, 89, 86],
  afh823:  [67, 97, 97, 75, 89],
  ech:     [89, 92, 91, 97, 89],
};

/** Points per quarter of improvement leading up to 2026-Q3 (negative for a
 * contractor whose performance is slipping). */
const TREND: Record<string, number> = {
  ppco: 2, afh882: 1.5, sibs: -1.5, abya: 3, rpco: -1, tdp: 0.5,
  thys: 2.5, sarco: 1, afh1272: -2.5, afh823: 2, ech: 1.5,
};

const QUARTERS: Array<[string, string]> = [
  ["2025-Q4", "2025-11-18"],
  ["2026-Q1", "2026-02-17"],
  ["2026-Q2", "2026-05-19"],
  ["2026-Q3", "2026-08-25"],
];

const DISCIPLINE_IDS: DisciplineId[] = ["hs", "crc", "env", "sec", "ww"];
const SEEDS: Record<string, number> = {
  ppco: 11, afh882: 21, sibs: 31, abya: 41, rpco: 51, tdp: 61,
  thys: 71, sarco: 81, afh1272: 91, afh823: 101, ech: 111,
};

const clampScore = (n: number) =>
  Math.round(Math.max(35, Math.min(99, n)) * 10) / 10;

/** Discipline scores for a quarter: the scorecard values at 2026-Q3, walked
 * backwards by the contractor's trend with a little deterministic variation. */
function scoresFor(
  contractorId: string,
  quartersBack: number,
): DisciplineScores {
  const base = SCORECARD[contractorId]!;
  const trend = TREND[contractorId] ?? 0;
  const seed = SEEDS[contractorId] ?? 7;
  const out: DisciplineScores = {};
  DISCIPLINE_IDS.forEach((id, i) => {
    if (quartersBack === 0) {
      out[id] = base[i]!;
      return;
    }
    const noise = (det(seed + i, quartersBack) - 0.5) * 3;
    out[id] = clampScore(base[i]! - trend * quartersBack + noise);
  });
  return out;
}

/**
 * Which hazards a contractor carries in scope — stable across its quarters,
 * because a scope of work does not change between audits. Driving and heat
 * apply to everyone; blasting and marine work to very few.
 */
function scopedHazards(contractorId: string): typeof CRITICAL_RISKS {
  const seed = SEEDS[contractorId] ?? 7;
  return CRITICAL_RISKS.filter(
    (risk, i) => det(seed + 257, i) < risk.prevalence,
  );
}

/**
 * Programme-wide tendency per hazard, in points either side of a
 * contractor's own CRC average. DEMO SHAPE ONLY — invented so the hazard
 * ranking has signal to read (height and lifting habitually weak, driving
 * and fire well controlled); it is not transcribed from any real audit.
 */
const HAZARD_BIAS: Record<CriticalRiskId, number> = {
  ground: 1, confined: -4, energized: -2, explosives: 0, fire: 3,
  hotwork: -1, lifting: -5, plant: 2, temporary: -3, driving: 4,
  height: -6, heat: 2, roads: 1, water: -2,
};

/**
 * Per-hazard CRC scores that average to the recorded discipline score.
 * Deviations are centred on zero before clamping so the mean holds, which
 * keeps the hazard breakdown consistent with the scorecard figure while
 * preserving the relative bias between hazards.
 */
function hazardScores(contractorId: string, target: number, qi: number): CriticalRiskScores {
  const risks = scopedHazards(contractorId);
  if (risks.length === 0) return {};
  const seed = (SEEDS[contractorId] ?? 7) + qi * 13;
  const raw = risks.map(
    (risk, i) => HAZARD_BIAS[risk.id] + (det(seed + 61, i) - 0.5) * 14,
  );
  const mean = raw.reduce((sum, v) => sum + v, 0) / raw.length;
  const centred = raw.map((v) => clampScore(v - mean + target));
  const drift =
    target - centred.reduce((sum, v) => sum + v, 0) / centred.length;
  const out: CriticalRiskScores = {};
  risks.forEach((risk, i) => {
    out[risk.id] = clampScore(centred[i]! + drift);
  });
  return out;
}

function buildAudits(): EhssAudit[] {
  const out: EhssAudit[] = [];

  for (const contractor of contractors) {
    QUARTERS.forEach(([quarter, date], qi) => {
      const quartersBack = QUARTERS.length - 1 - qi;
      // Stable per contractor: the quarter is mixed in inside genResponses,
      // so a finding carries over instead of being redrawn.
      const base = SEEDS[contractor.id] ?? 7;
      const scores = scoresFor(contractor.id, quartersBack);

      // TDP's current-quarter review is still being filled in.
      const isOpenDraft = contractor.id === "tdp" && quarter === "2026-Q3";
      // Al Fahd (1272) is the workbook's own audit — project 4800001272.
      const isWorkbook = contractor.id === "afh1272" && quarter === "2026-Q3";

      if (isOpenDraft) {
        out.push({
          id: `${contractor.id}-${quarter}`,
          contractorId: contractor.id,
          quarter,
          auditDate: "2026-09-16",
          inspectionNo: `EHSS-${quarter}-${contractor.code}`,
          status: "draft",
          responses: draftResponses(base, qi, scores.hs! / 100),
          disciplineScores: {},
          criticalRisks: {},
        });
        return;
      }

      out.push({
        id: `${contractor.id}-${quarter}`,
        contractorId: contractor.id,
        quarter,
        auditDate: isWorkbook ? "2026-07-19" : date,
        inspectionNo: isWorkbook
          ? "HSW-03"
          : `EHSS-${quarter}-${contractor.code}`,
        status: quarter === "2026-Q3" ? "submitted" : "approved",
        responses: isWorkbook
          ? workbookResponses()
          : genResponses(base, qi, scores.hs! / 100),
        // The workbook review's H&S score comes from its checklist answers.
        disciplineScores: isWorkbook
          ? { crc: scores.crc, env: scores.env, sec: scores.sec, ww: scores.ww }
          : scores,
        criticalRisks: hazardScores(contractor.id, scores.crc!, qi),
      });
    });
  }

  return out;
}

export const audits: EhssAudit[] = buildAudits();

export const contractorById = new Map(contractors.map((c) => [c.id, c]));
export const subRegionById = new Map(subRegions.map((s) => [s.id, s]));
