import {
  CORRECTIVE_ACTION_LABELS,
  STATUS_LABELS,
} from "@/lib/format";
import type { AuditStatus, CorrectiveActionStatus } from "@/lib/types";

const AUDIT_STATUS_TONE: Record<AuditStatus, string> = {
  draft: "",
  submitted: "accent",
  approved: "good",
};

export function AuditStatusBadge({ status }: { status: AuditStatus }) {
  return (
    <span className={`badge ${AUDIT_STATUS_TONE[status]}`}>
      <span className="dot" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

const CA_TONE: Record<CorrectiveActionStatus, string> = {
  open: "serious",
  in_progress: "warning",
  closed: "good",
  verified: "good",
};

export function CorrectiveActionBadge({
  status,
}: {
  status: CorrectiveActionStatus;
}) {
  return (
    <span className={`badge ${CA_TONE[status]}`}>
      <span className="dot" aria-hidden />
      {CORRECTIVE_ACTION_LABELS[status]}
    </span>
  );
}
