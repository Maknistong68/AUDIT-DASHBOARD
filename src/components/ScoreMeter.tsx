import { formatScore } from "@/lib/format";
import { bandClass } from "@/lib/ehss/bands";

/** Inline score meter: sequential accent fill on a same-ramp lighter track. */
export function ScoreMeter({ score }: { score: number | null }) {
  return (
    <span className={`meter ${bandClass(score)}`}>
      <span className="track" aria-hidden>
        {score !== null && (
          <span className="fill" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
        )}
      </span>
      <span className="pct">{formatScore(score)}</span>
    </span>
  );
}
