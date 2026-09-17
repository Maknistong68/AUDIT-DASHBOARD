export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Accent stripe: follows the rating band, never the rank. */
  tone?: "good" | "warning" | "serious" | "critical" | "neutral";
}) {
  return (
    <div className={`stat-tile${tone ? ` tone-${tone}` : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}
