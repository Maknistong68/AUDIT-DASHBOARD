/**
 * Demo dataset: Oxagon's two sub-regions, contractors in each, and quarterly
 * EHSS audits across 2026. Answers are generated deterministically per
 * contractor/quarter quality profile; one audit (Contractor Four, Q3) is the
 * source workbook's real answer set, so its scores match the Excel exactly.
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

export const subRegions: SubRegion[] = [
  { id: "sr1", name: "Sub Region 1" },
  { id: "sr2", name: "Sub Region 2" },
];

export const contractors: EhssContractor[] = [
  { id: "c1", code: "CON-01", name: "Contractor One", subRegionId: "sr1" },
  { id: "c2", code: "CON-02", name: "Contractor Two", subRegionId: "sr1" },
  { id: "c3", code: "CON-03", name: "Contractor Three", subRegionId: "sr1" },
  { id: "c4", code: "CON-04", name: "Contractor Four", subRegionId: "sr2" },
  { id: "c5", code: "CON-05", name: "Contractor Five", subRegionId: "sr2" },
];

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

interface AuditDef {
  id: string;
  contractorId: string;
  quarter: string;
  auditDate: string;
  inspectionNo: string;
  status: EhssAudit["status"];
  responses: Record<string, EhssResponse>;
}

const defs: AuditDef[] = [
  // Contractor One (SR1) — improving
  { id: "e01", contractorId: "c1", quarter: "2026-Q1", auditDate: "2026-02-11", inspectionNo: "HSW-01", status: "approved",  responses: genResponses(11, 0.58) },
  { id: "e02", contractorId: "c1", quarter: "2026-Q2", auditDate: "2026-05-13", inspectionNo: "HSW-02", status: "approved",  responses: genResponses(12, 0.71) },
  { id: "e03", contractorId: "c1", quarter: "2026-Q3", auditDate: "2026-08-12", inspectionNo: "HSW-03", status: "submitted", responses: genResponses(13, 0.84) },
  // Contractor Two (SR1) — declining
  { id: "e04", contractorId: "c2", quarter: "2026-Q1", auditDate: "2026-02-25", inspectionNo: "HSW-01", status: "approved",  responses: genResponses(21, 0.8) },
  { id: "e05", contractorId: "c2", quarter: "2026-Q2", auditDate: "2026-05-27", inspectionNo: "HSW-02", status: "approved",  responses: genResponses(22, 0.74) },
  { id: "e06", contractorId: "c2", quarter: "2026-Q3", auditDate: "2026-08-26", inspectionNo: "HSW-03", status: "submitted", responses: genResponses(23, 0.66) },
  // Contractor Three (SR1) — new, Q3 audit still in progress
  { id: "e07", contractorId: "c3", quarter: "2026-Q2", auditDate: "2026-06-03", inspectionNo: "HSW-01", status: "approved",  responses: genResponses(31, 0.62) },
  { id: "e08", contractorId: "c3", quarter: "2026-Q3", auditDate: "2026-09-16", inspectionNo: "HSW-02", status: "draft",     responses: draftResponses(32, 0.68) },
  // Contractor Four (SR2) — Q3 is the workbook's real audit
  { id: "e09", contractorId: "c4", quarter: "2026-Q1", auditDate: "2026-01-21", inspectionNo: "HSW-01", status: "approved",  responses: genResponses(41, 0.55) },
  { id: "e10", contractorId: "c4", quarter: "2026-Q2", auditDate: "2026-04-22", inspectionNo: "HSW-02", status: "approved",  responses: genResponses(43, 0.6) },
  { id: "e11", contractorId: "c4", quarter: "2026-Q3", auditDate: "2026-07-19", inspectionNo: "HSW-03", status: "submitted", responses: workbookResponses() },
  // Contractor Five (SR2) — strong and steady
  { id: "e12", contractorId: "c5", quarter: "2026-Q1", auditDate: "2026-03-04", inspectionNo: "HSW-01", status: "approved",  responses: genResponses(51, 0.88) },
  { id: "e13", contractorId: "c5", quarter: "2026-Q2", auditDate: "2026-06-10", inspectionNo: "HSW-02", status: "approved",  responses: genResponses(52, 0.9) },
  { id: "e14", contractorId: "c5", quarter: "2026-Q3", auditDate: "2026-09-02", inspectionNo: "HSW-03", status: "submitted", responses: genResponses(53, 0.93) },
];

export const audits: EhssAudit[] = defs;

export const contractorById = new Map(contractors.map((c) => [c.id, c]));
export const subRegionById = new Map(subRegions.map((s) => [s.id, s]));
export const auditById = new Map(audits.map((a) => [a.id, a]));
