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

export const STATUS_LABELS: Record<"draft" | "submitted" | "approved", string> =
  {
    draft: "Draft",
    submitted: "Submitted",
    approved: "Approved",
  };
