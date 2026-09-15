/**
 * Domain types — mirror of the database enums and core rows.
 * Keep in sync with supabase/migrations/0001_schema.sql
 * (or replace with `supabase gen types typescript` output once the project
 * is wired to a Supabase instance).
 */

export type AuditResult = "full_compliance" | "non_compliance" | "not_applicable";

export type ObservationType = "positive_practice" | "improvement_opportunity";

export type AuditStatus = "draft" | "submitted" | "approved";

export type CorrectiveActionStatus = "open" | "in_progress" | "closed" | "verified";

export type UserRole = "admin" | "auditor" | "viewer";

export interface Contractor {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface AuditType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface NcCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
}

export interface AuditQuestion {
  id: string;
  auditTypeId: string;
  code: string;
  category: string;
  question: string;
  weight: number;
  sortOrder: number;
  active: boolean;
}

export interface Audit {
  id: string;
  contractorId: string;
  auditTypeId: string;
  auditDate: string; // ISO date
  status: AuditStatus;
  auditorId: string;
  score: number | null;
}

export interface AuditResponse {
  id: string;
  auditId: string;
  questionId: string;
  result: AuditResult;
  ncCategoryId: string | null;
  observation: ObservationType | null;
  correctiveActionStatus: CorrectiveActionStatus | null;
}

/** Minimal shape the scoring functions need. */
export interface ScorableResponse {
  result: AuditResult;
  /** Question weight; must be > 0. */
  weight: number;
}
