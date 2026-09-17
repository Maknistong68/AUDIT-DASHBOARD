/**
 * Demo mode dataset — the app's data source when Supabase is not configured.
 * Mirrors supabase/mock_data.sql exactly (same contractors, audits, results
 * and corrective actions), plus one editable draft so the entry form can be
 * tried. Everything is derived at module load with the same scoring rules as
 * the database.
 */

import { computeScore } from "../scoring";
import type {
  AuditQuestionRow,
  AuditResponseRow,
  AuditScoreRow,
  AuditTypeRow,
  ContractorLatestScoreRow,
  ContractorRow,
  NcBreakdownRow,
  NcCategoryRow,
  QuestionPerformanceRow,
} from "../db";
import type {
  AuditStatus,
  CorrectiveActionStatus,
  ObservationType,
} from "../types";

export const DEMO_USER_ID = "demo-user";

export const demoAuditType: AuditTypeRow = {
  id: "wma",
  code: "WMA",
  name: "Welfare Management Audit",
  active: true,
};

export const demoContractors: ContractorRow[] = [
  { id: "c1", code: "C1", name: "Contractor One", active: true },
  { id: "c2", code: "C2", name: "Contractor Two", active: true },
  { id: "c3", code: "C3", name: "Contractor Three", active: true },
];

export const demoNcCategories: NcCategoryRow[] = [
  { id: "nc-nav", code: "NC-NAV", name: "Documentation Not Available", description: "The required document or control does not exist.", sort_order: 10, active: true },
  { id: "nc-nap", code: "NC-NAP", name: "Documentation Available but Not Approved", description: "The document exists but the required approval is absent.", sort_order: 20, active: true },
  { id: "nc-inc", code: "NC-INC", name: "Incomplete Documentation / Missing Requirements", description: "The document exists but required elements are missing.", sort_order: 30, active: true },
  { id: "nc-nim", code: "NC-NIM", name: "Not Implemented", description: "The document/control exists but is not implemented.", sort_order: 40, active: true },
  { id: "nc-pim", code: "NC-PIM", name: "Partially Implemented", description: "Implementation has started but is incomplete.", sort_order: 50, active: true },
  { id: "nc-oth", code: "NC-OTH", name: "Other (Controlled)", description: "Does not fit the standard classifications.", sort_order: 60, active: true },
];

const QUESTION_DEFS: Array<[string, string, string]> = [
  ["WMP-01", "Worker Management Plan", "Worker Management Plan is established and implemented in accordance with applicable requirements."],
  ["WMP-02", "Worker Management Plan", "Worker Management Plan is reviewed and updated at the required frequency and re-approved after changes."],
  ["WMP-03", "Worker Management Plan", "Roles and responsibilities for welfare management are defined, assigned and communicated."],
  ["ACC-01", "Accommodation", "Worker accommodation is provided and maintained in accordance with applicable standards."],
  ["ACC-02", "Accommodation", "Accommodation inspection program is established and inspections are performed at the required frequency."],
  ["TRN-01", "Transportation", "Worker transportation arrangements comply with applicable safety and welfare requirements."],
  ["CAT-01", "Catering & Water", "Catering and drinking water provisions comply with applicable health and welfare requirements."],
  ["GRV-01", "Grievance Mechanism", "A worker grievance mechanism is established, communicated and implemented in accordance with applicable requirements."],
  ["GRV-02", "Grievance Mechanism", "Grievances are tracked, resolved and closed within the required timeframes."],
  ["WEL-01", "Welfare Officer", "Qualified welfare personnel are appointed in accordance with applicable requirements."],
  ["TRG-01", "Training & Awareness", "Worker welfare induction and awareness training is delivered in accordance with applicable requirements."],
  ["MON-01", "Monitoring & Reporting", "Welfare monitoring, self-inspection and reporting are performed at the required frequency."],
];

export const demoQuestions: AuditQuestionRow[] = QUESTION_DEFS.map(
  ([code, category, question], i) => ({
    id: `q-${code.toLowerCase()}`,
    audit_type_id: demoAuditType.id,
    code,
    category,
    question,
    weight: 1,
    sort_order: (i + 1) * 10,
    active: true,
  }),
);

// Which taxonomy entry each control's NC demonstrates (same map as mock_data.sql).
const NC_CATEGORY_BY_QUESTION: Record<string, string> = {
  "WMP-01": "nc-nav",
  "WMP-02": "nc-nap",
  "ACC-01": "nc-pim",
  "ACC-02": "nc-nim",
  "CAT-01": "nc-pim",
  "MON-01": "nc-nav",
  "WEL-01": "nc-nap",
};
const ncCategoryFor = (code: string) => NC_CATEGORY_BY_QUESTION[code] ?? "nc-inc";

interface AuditDef {
  id: string;
  contractorId: string;
  date: string;
  status: AuditStatus;
  nc: Record<string, CorrectiveActionStatus | null>;
  na: string[];
  obs: Record<string, ObservationType>;
  /** draft only: question codes answered so far (others left blank) */
  answered?: string[];
}

const AUDIT_DEFS: AuditDef[] = [
  { id: "a1", contractorId: "c1", date: "2026-03-15", status: "approved",
    nc: { "WMP-02": "closed", "ACC-01": "closed", "ACC-02": "verified", "GRV-02": "closed", "TRG-01": "verified" },
    na: [], obs: {} },
  { id: "a2", contractorId: "c1", date: "2026-06-10", status: "approved",
    nc: { "ACC-02": "closed", "GRV-02": "in_progress", "TRG-01": "closed" },
    na: [], obs: {} },
  { id: "a3", contractorId: "c1", date: "2026-09-05", status: "submitted",
    nc: { "GRV-02": "open" },
    na: ["TRN-01"], obs: { "WMP-01": "positive_practice" } },
  { id: "a4", contractorId: "c2", date: "2026-04-20", status: "approved",
    nc: { "CAT-01": "verified", "MON-01": "closed" },
    na: [], obs: {} },
  { id: "a5", contractorId: "c2", date: "2026-07-15", status: "submitted",
    nc: { "CAT-01": "open", "MON-01": "in_progress", "ACC-01": "open" },
    na: ["TRN-01"], obs: { "WEL-01": "improvement_opportunity" } },
  { id: "a6", contractorId: "c3", date: "2026-08-28", status: "approved",
    nc: { "WMP-01": "open", "WMP-02": "open", "WEL-01": "in_progress", "TRG-01": "open" },
    na: [], obs: {} },
  // In-progress draft: lets visitors try the entry form and live score.
  { id: "a7", contractorId: "c3", date: "2026-09-14", status: "draft",
    nc: { "ACC-01": null },
    na: ["TRN-01"], obs: {},
    answered: ["WMP-01", "WMP-02", "WMP-03", "ACC-01", "TRN-01"] },
];

export interface DemoAudit {
  id: string;
  contractor_id: string;
  audit_type_id: string;
  audit_date: string;
  status: AuditStatus;
  auditor_id: string;
  score: number | null;
}

function buildResponses(def: AuditDef): AuditResponseRow[] {
  return demoQuestions
    .filter((q) => !def.answered || def.answered.includes(q.code))
    .map((q) => {
      const isNc = q.code in def.nc;
      const isNa = def.na.includes(q.code);
      return {
        id: `${def.id}-${q.id}`,
        audit_id: def.id,
        question_id: q.id,
        result: isNc ? "non_compliance" : isNa ? "not_applicable" : "full_compliance",
        nc_category_id: isNc ? ncCategoryFor(q.code) : null,
        observation: def.obs[q.code] ?? null,
        corrective_action_status: isNc ? (def.nc[q.code] ?? null) : null,
      };
    });
}

export const demoResponses: AuditResponseRow[] = AUDIT_DEFS.flatMap(buildResponses);

export const demoAudits: DemoAudit[] = AUDIT_DEFS.map((def) => {
  const responses = demoResponses.filter((r) => r.audit_id === def.id);
  return {
    id: def.id,
    contractor_id: def.contractorId,
    audit_type_id: demoAuditType.id,
    audit_date: def.date,
    status: def.status,
    auditor_id: DEMO_USER_ID,
    score: computeScore(responses.map((r) => ({ result: r.result, weight: 1 }))),
  };
});

/* ---- Derived "views" (same semantics as the v_* SQL views) ---- */

const contractorById = new Map(demoContractors.map((c) => [c.id, c]));
const questionById = new Map(demoQuestions.map((q) => [q.id, q]));
const ncCategoryById = new Map(demoNcCategories.map((n) => [n.id, n]));

const finalized = demoAudits.filter(
  (a) => a.status === "submitted" || a.status === "approved",
);

export const demoAuditScores: AuditScoreRow[] = finalized
  .map((a) => {
    const c = contractorById.get(a.contractor_id)!;
    return {
      audit_id: a.id,
      contractor_id: c.id,
      contractor_code: c.code,
      contractor_name: c.name,
      audit_type_id: demoAuditType.id,
      audit_type_code: demoAuditType.code,
      audit_type_name: demoAuditType.name,
      audit_date: a.audit_date,
      status: a.status,
      score: a.score,
    };
  })
  .sort((a, b) => a.audit_date.localeCompare(b.audit_date));

export const demoLatestScores: ContractorLatestScoreRow[] = demoContractors
  .map((c) => {
    const scores = demoAuditScores.filter((s) => s.contractor_id === c.id);
    const latest = scores[scores.length - 1];
    if (!latest) return null;
    return {
      contractor_id: c.id,
      contractor_code: c.code,
      contractor_name: c.name,
      audit_type_id: demoAuditType.id,
      audit_type_code: demoAuditType.code,
      audit_type_name: demoAuditType.name,
      latest_audit_date: latest.audit_date,
      latest_score: latest.score,
    };
  })
  .filter((r): r is ContractorLatestScoreRow => r !== null);

export const demoNcBreakdown: NcBreakdownRow[] = demoResponses
  .filter(
    (r) =>
      r.result === "non_compliance" &&
      finalized.some((a) => a.id === r.audit_id),
  )
  .map((r) => {
    const a = demoAudits.find((x) => x.id === r.audit_id)!;
    const c = contractorById.get(a.contractor_id)!;
    const q = questionById.get(r.question_id)!;
    const n = ncCategoryById.get(r.nc_category_id!)!;
    return {
      audit_id: a.id,
      contractor_id: c.id,
      contractor_name: c.name,
      audit_type_id: demoAuditType.id,
      audit_type_name: demoAuditType.name,
      audit_date: a.audit_date,
      question_id: q.id,
      question_code: q.code,
      question_category: q.category,
      nc_category_id: n.id,
      nc_category_code: n.code,
      nc_category_name: n.name,
      corrective_action_status: r.corrective_action_status,
    };
  });

export const demoQuestionPerformance: QuestionPerformanceRow[] = demoQuestions
  .map((q) => {
    const rs = demoResponses.filter(
      (r) =>
        r.question_id === q.id && finalized.some((a) => a.id === r.audit_id),
    );
    const applicable = rs.filter((r) => r.result !== "not_applicable").length;
    const compliant = rs.filter((r) => r.result === "full_compliance").length;
    const nc = rs.filter((r) => r.result === "non_compliance").length;
    return {
      question_id: q.id,
      audit_type_id: q.audit_type_id,
      question_code: q.code,
      question_category: q.category,
      question: q.question,
      times_applicable: applicable,
      times_compliant: compliant,
      times_non_compliant: nc,
      compliance_rate:
        applicable === 0
          ? null
          : Math.round((compliant / applicable) * 10000) / 100,
    };
  })
  .filter((q) => q.times_applicable > 0);
