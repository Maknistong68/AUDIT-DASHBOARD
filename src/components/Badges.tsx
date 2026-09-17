import { STATUS_LABELS } from "@/lib/format";
import type { EhssAuditStatus } from "@/lib/ehss/model";

const AUDIT_STATUS_TONE: Record<EhssAuditStatus, string> = {
  draft: "",
  submitted: "accent",
  approved: "good",
};

export function AuditStatusBadge({ status }: { status: EhssAuditStatus }) {
  return (
    <span className={`badge ${AUDIT_STATUS_TONE[status]}`}>
      <span className="dot" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Rating bands from the workbook. Color supplements the label, never alone. */
const RATING_TONE: Record<string, string> = {
  Compliant: "good",
  "Mostly Compliant": "good",
  "Moderately Compliant": "warning",
  "Minimally Compliant": "serious",
  "Non-Compliant": "critical",
};

export function RatingBadge({ rating }: { rating: string | null }) {
  if (!rating) return <span style={{ color: "var(--muted)" }}>—</span>;
  return (
    <span className={`badge ${RATING_TONE[rating] ?? ""}`}>
      <span className="dot" aria-hidden />
      {rating}
    </span>
  );
}
