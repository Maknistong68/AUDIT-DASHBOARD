/**
 * Row shapes as the database returns them (snake_case), for the tables and
 * analytics views the app reads. Replace with `supabase gen types typescript`
 * output once the project is linked to a Supabase instance.
 */

import type {
  AuditResult,
  AuditStatus,
  CorrectiveActionStatus,
  ObservationType,
  UserRole,
} from "./types";

export interface ContractorRow {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface AuditTypeRow {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface NcCategoryRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
}

export interface AuditQuestionRow {
  id: string;
  audit_type_id: string;
  code: string;
  category: string;
  question: string;
  weight: number;
  sort_order: number;
  active: boolean;
}

export interface AuditRow {
  id: string;
  contractor_id: string;
  audit_type_id: string;
  audit_date: string;
  status: AuditStatus;
  auditor_id: string;
  score: number | null;
}

export interface AuditResponseRow {
  id: string;
  audit_id: string;
  question_id: string;
  result: AuditResult;
  nc_category_id: string | null;
  observation: ObservationType | null;
  corrective_action_status: CorrectiveActionStatus | null;
}

export interface ProfileRow {
  id: string;
  full_name: string | null;
  role: UserRole;
}

/* Analytics views (0002_scoring.sql) */

export interface AuditScoreRow {
  audit_id: string;
  contractor_id: string;
  contractor_code: string;
  contractor_name: string;
  audit_type_id: string;
  audit_type_code: string;
  audit_type_name: string;
  audit_date: string;
  status: AuditStatus;
  score: number | null;
}

export interface ContractorLatestScoreRow {
  contractor_id: string;
  contractor_code: string;
  contractor_name: string;
  audit_type_id: string;
  audit_type_code: string;
  audit_type_name: string;
  latest_audit_date: string;
  latest_score: number | null;
}

export interface NcBreakdownRow {
  audit_id: string;
  contractor_id: string;
  contractor_name: string;
  audit_type_id: string;
  audit_type_name: string;
  audit_date: string;
  question_id: string;
  question_code: string;
  question_category: string;
  nc_category_id: string;
  nc_category_code: string;
  nc_category_name: string;
  corrective_action_status: CorrectiveActionStatus | null;
}

export interface QuestionPerformanceRow {
  question_id: string;
  audit_type_id: string;
  question_code: string;
  question_category: string;
  question: string;
  times_applicable: number;
  times_compliant: number;
  times_non_compliant: number;
  compliance_rate: number | null;
}
