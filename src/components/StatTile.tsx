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
  tone?:
    | "compliant"
    | "mostly"
    | "moderate"
    | "minimal"
    | "non"
    | "neutral";
}) {
  // A tile's value is normally a short figure set large. Some are words
  // ("Moderately Compliant"), which at that size wrap into three lines and
  // break the row's rhythm — those step down a size instead.
  const isWordy = value.length > 7;

  return (
    <div className={`stat-tile${tone ? ` tone-${tone}` : ""}`}>
      <div className="label">{label}</div>
      <div className={`value${isWordy ? " is-wordy" : ""}`}>{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}
