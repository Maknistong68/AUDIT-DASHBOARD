/**
 * Demo dataset: Oxagon's two sub-regions, their contractors, and quarterly
 * EHSS reviews from 2025-Q3 to 2026-Q3. Answers are generated
 * deterministically from a per-audit quality profile; one audit (Contractor
 * Four, 2026-Q3) is the source workbook's real answer set, so its scores
 * match the Excel exactly.
 *
 * This is the baseline the browser store layers user edits on top of.
 */

import { CHECKLIST, WORKBOOK_FIXTURE_ANSWERS } from "./checklist";
import { flattenChecklist } from "./scoring";
import type {
  EhssAnswer,
  EhssAudit,
  EhssContractor,
  EhssResponse,
  ObservationCode,
  SubRegion,
} from "./model";
import type { DisciplineId, DisciplineScores } from "./disciplines";

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

/** Display name as it appears on the scorecard: "Al Fahd (1272)". */
export const contractorLabel = (c: { name: string; code: string }) =>
  `${c.name} (${c.code})`;

const FLAT = flattenChecklist(CHECKLIST);
const GAP_OBSERVATIONS: ObservationCode[] = ["OB2", "OB3", "OB4", "OB5"];

/** Deterministic pseudo-random in [0, 1) from a seed and index. */
function det(seed: number, i: number): number {
  const x = Math.sin(seed * 374761 + i * 668265) * 43758.5453;
  return x - Math.floor(x);
}

function gapObservation(seed: number, i: number): ObservationCode {
  return GAP_OBSERVATIONS[Math.floor(det(seed + 7, i) * 4)]!;
}

/**
 * Generate a full answer set. `quality` (0..1) steers the Full/Partial/No
 * mix, so the resulting total lands near quality×100 without being exact.
 */
function genResponses(seed: number, quality: number): Record<string, EhssResponse> {
  const pFull = Math.max(0, Math.min(1, quality * 1.35 - 0.35));
  const pPartial = Math.max(0.1, Math.min(1 - pFull, (1 - pFull) * 0.75));
  const responses: Record<string, EhssResponse> = {};
  FLAT.forEach(({ question }, i) => {
    if (det(seed + 3, i) < 0.06) {
      responses[question.code] = { answer: "na", observation: null };
      return;
    }
    const r = det(seed, i);
    let answer: EhssAnswer;
    if (r < pFull) answer = "full";
    else if (r < pFull + pPartial) answer = "partial";
    else answer = "no";
    responses[question.code] = {
      answer,
      observation:
        answer === "full"
          ? det(seed + 11, i) < 0.12
            ? "OB1"
            : null
          : gapObservation(seed, i),
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
      observation:
        answer === "partial" || answer === "no" ? gapObservation(42, i) : null,
    };
  });
  return responses;
}

/** Partially answered draft (about half the checklist). */
function draftResponses(seed: number, quality: number): Record<string, EhssResponse> {
  const full = genResponses(seed, quality);
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

function buildAudits(): EhssAudit[] {
  const out: EhssAudit[] = [];

  for (const contractor of contractors) {
    QUARTERS.forEach(([quarter, date], qi) => {
      const quartersBack = QUARTERS.length - 1 - qi;
      const seed = (SEEDS[contractor.id] ?? 7) + qi;
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
          responses: draftResponses(seed, scores.hs! / 100),
          disciplineScores: {},
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
          : genResponses(seed, scores.hs! / 100),
        // The workbook review's H&S score comes from its checklist answers.
        disciplineScores: isWorkbook
          ? { crc: scores.crc, env: scores.env, sec: scores.sec, ww: scores.ww }
          : scores,
      });
    });
  }

  return out;
}

export const audits: EhssAudit[] = buildAudits();

export const contractorById = new Map(contractors.map((c) => [c.id, c]));
export const subRegionById = new Map(subRegions.map((s) => [s.id, s]));
