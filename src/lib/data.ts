/**
 * Unified data layer. Every page reads through these functions:
 * in demo mode they serve the built-in dataset; with Supabase configured
 * they run the same queries the pages used to run directly (RLS applies).
 */

import { createClient } from "./supabase/server";
import { isDemoMode } from "./demo/mode";
import { readDemoProfile } from "./demo/profile";
import {
  DEMO_USER_ID,
  demoAuditScores,
  demoAudits,
  demoAuditType,
  demoContractors,
  demoLatestScores,
  demoNcBreakdown,
  demoNcCategories,
  demoQuestionPerformance,
  demoQuestions,
  demoResponses,
} from "./demo/data";
import type {
  AuditQuestionRow,
  AuditResponseRow,
  AuditScoreRow,
  ContractorLatestScoreRow,
  ContractorRow,
  NcBreakdownRow,
  NcCategoryRow,
  QuestionPerformanceRow,
} from "./db";
import type { AuditStatus, UserRole } from "./types";

export interface CurrentUser {
  id: string;
  name: string | null;
  role: UserRole;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (isDemoMode()) {
    const profile = await readDemoProfile();
    return profile
      ? { id: DEMO_USER_ID, name: profile.name, role: profile.role }
      : null;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();
  const row = data as { full_name: string | null; role: UserRole } | null;
  return row ? { id: user.id, name: row.full_name, role: row.role } : null;
}

export async function getAuditScores(): Promise<AuditScoreRow[]> {
  if (isDemoMode()) return demoAuditScores;
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_audit_scores")
    .select("*")
    .order("audit_date");
  return (data ?? []) as AuditScoreRow[];
}

export async function getLatestScores(): Promise<ContractorLatestScoreRow[]> {
  if (isDemoMode()) return demoLatestScores;
  const supabase = await createClient();
  const { data } = await supabase.from("v_contractor_latest_scores").select("*");
  return (data ?? []) as ContractorLatestScoreRow[];
}

export async function getNcBreakdown(
  contractorId?: string,
): Promise<NcBreakdownRow[]> {
  if (isDemoMode()) {
    return contractorId
      ? demoNcBreakdown.filter((r) => r.contractor_id === contractorId)
      : demoNcBreakdown;
  }
  const supabase = await createClient();
  let query = supabase.from("v_nc_breakdown").select("*").order("audit_date");
  if (contractorId) query = query.eq("contractor_id", contractorId);
  const { data } = await query;
  return (data ?? []) as NcBreakdownRow[];
}

export async function getWeakestQuestions(
  limit: number,
): Promise<QuestionPerformanceRow[]> {
  if (isDemoMode()) {
    return [...demoQuestionPerformance]
      .sort(
        (a, b) => (a.compliance_rate ?? 101) - (b.compliance_rate ?? 101),
      )
      .slice(0, limit);
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_question_performance")
    .select("*")
    .order("compliance_rate", { ascending: true })
    .limit(limit);
  return (data ?? []) as QuestionPerformanceRow[];
}

export async function getContractors(): Promise<ContractorRow[]> {
  if (isDemoMode()) return demoContractors;
  const supabase = await createClient();
  const { data } = await supabase
    .from("contractors")
    .select("*")
    .eq("active", true)
    .order("name");
  return (data ?? []) as ContractorRow[];
}

export async function getContractor(id: string): Promise<ContractorRow | null> {
  if (isDemoMode()) return demoContractors.find((c) => c.id === id) ?? null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("contractors")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as ContractorRow | null) ?? null;
}

export async function getContractorScores(
  contractorId: string,
): Promise<AuditScoreRow[]> {
  if (isDemoMode()) {
    return demoAuditScores.filter((s) => s.contractor_id === contractorId);
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_audit_scores")
    .select("*")
    .eq("contractor_id", contractorId)
    .order("audit_date");
  return (data ?? []) as AuditScoreRow[];
}

export interface AuditListRow {
  id: string;
  audit_date: string;
  status: AuditStatus;
  score: number | null;
  contractor_name: string | null;
  audit_type_name: string | null;
}

/** Audits visible to the current user (demo: everything, drafts included). */
export async function getAuditsList(): Promise<AuditListRow[]> {
  if (isDemoMode()) {
    return [...demoAudits]
      .sort((a, b) => b.audit_date.localeCompare(a.audit_date))
      .map((a) => ({
        id: a.id,
        audit_date: a.audit_date,
        status: a.status,
        score: a.score,
        contractor_name:
          demoContractors.find((c) => c.id === a.contractor_id)?.name ?? null,
        audit_type_name: demoAuditType.name,
      }));
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("audits")
    .select(
      "id, audit_date, status, score, contractors(name), audit_types(name)",
    )
    .order("audit_date", { ascending: false });
  return ((data ?? []) as unknown as Array<
    Omit<AuditListRow, "contractor_name" | "audit_type_name"> & {
      contractors: { name: string } | null;
      audit_types: { name: string } | null;
    }
  >).map((a) => ({
    id: a.id,
    audit_date: a.audit_date,
    status: a.status,
    score: a.score,
    contractor_name: a.contractors?.name ?? null,
    audit_type_name: a.audit_types?.name ?? null,
  }));
}

export interface AuditDetail {
  id: string;
  contractor_name: string;
  audit_type_name: string;
  audit_date: string;
  status: AuditStatus;
  auditor_id: string;
  questions: AuditQuestionRow[];
  responses: AuditResponseRow[];
  ncCategories: NcCategoryRow[];
}

export async function getAuditDetail(id: string): Promise<AuditDetail | null> {
  if (isDemoMode()) {
    const audit = demoAudits.find((a) => a.id === id);
    if (!audit) return null;
    return {
      id: audit.id,
      contractor_name:
        demoContractors.find((c) => c.id === audit.contractor_id)?.name ?? "",
      audit_type_name: demoAuditType.name,
      audit_date: audit.audit_date,
      status: audit.status,
      auditor_id: audit.auditor_id,
      questions: demoQuestions,
      responses: demoResponses.filter((r) => r.audit_id === id),
      ncCategories: demoNcCategories,
    };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("audits")
    .select("*, contractors(name), audit_types(name)")
    .eq("id", id)
    .maybeSingle();
  const audit = data as unknown as
    | {
        id: string;
        audit_type_id: string;
        audit_date: string;
        status: AuditStatus;
        auditor_id: string;
        contractors: { name: string } | null;
        audit_types: { name: string } | null;
      }
    | null;
  if (!audit) return null;

  const [questionsRes, responsesRes, ncRes] = await Promise.all([
    supabase
      .from("audit_questions")
      .select("*")
      .eq("audit_type_id", audit.audit_type_id)
      .eq("active", true)
      .order("sort_order"),
    supabase.from("audit_responses").select("*").eq("audit_id", id),
    supabase
      .from("nc_categories")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
  ]);

  return {
    id: audit.id,
    contractor_name: audit.contractors?.name ?? "",
    audit_type_name: audit.audit_types?.name ?? "",
    audit_date: audit.audit_date,
    status: audit.status,
    auditor_id: audit.auditor_id,
    questions: (questionsRes.data ?? []) as AuditQuestionRow[],
    responses: (responsesRes.data ?? []) as AuditResponseRow[],
    ncCategories: (ncRes.data ?? []) as NcCategoryRow[],
  };
}

/** Audit ids owned by the current user (for the corrective-action queue). */
export async function getOwnedAuditIds(userId: string): Promise<Set<string>> {
  if (isDemoMode()) {
    return new Set(demoAudits.map((a) => a.id)); // demo visitor owns the data
  }
  const supabase = await createClient();
  const { data } = await supabase.from("audits").select("id, auditor_id");
  return new Set(
    ((data ?? []) as { id: string; auditor_id: string }[])
      .filter((a) => a.auditor_id === userId)
      .map((a) => a.id),
  );
}
