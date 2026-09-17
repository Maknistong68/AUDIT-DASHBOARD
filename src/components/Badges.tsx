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

/** Rating badge: the band's colour supplements its name, never replaces it. */
const BAND_CLASS: Record<string, string> = {
  Compliant: "band-compliant",
  "Mostly Compliant": "band-mostly",
  "Moderately Compliant": "band-moderate",
  "Minimally Compliant": "band-minimal",
  "Non-Compliant": "band-non",
};

export function RatingBadge({ rating }: { rating: string | null }) {
  if (!rating) return <span style={{ color: "var(--muted)" }}>—</span>;
  return (
    <span className={`badge ${BAND_CLASS[rating] ?? ""}`}>
      <span className="dot" aria-hidden />
      {rating}
    </span>
  );
}
