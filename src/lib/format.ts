import type {
  AuditResult,
  AuditStatus,
  CorrectiveActionStatus,
  ObservationType,
} from "./types";

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  return `${Number(score).toFixed(score % 1 === 0 ? 0 : 1)}%`;
}

export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const RESULT_LABELS: Record<AuditResult, string> = {
  full_compliance: "Full Compliance",
  non_compliance: "Non-Compliance",
  not_applicable: "Not Applicable",
};

export const STATUS_LABELS: Record<AuditStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
};

export const OBSERVATION_LABELS: Record<ObservationType, string> = {
  positive_practice: "Positive Practice",
  improvement_opportunity: "Improvement Opportunity",
};

export const CORRECTIVE_ACTION_LABELS: Record<CorrectiveActionStatus, string> =
  {
    open: "Open",
    in_progress: "In Progress",
    closed: "Closed",
    verified: "Verified",
  };
