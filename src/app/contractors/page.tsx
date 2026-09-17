import Link from "next/link";
import { audits, contractors, subRegions } from "@/lib/ehss/mock";
import { latestByContractor, summarizeAll } from "@/lib/ehss/summaries";
import { quarterLabel } from "@/lib/ehss/model";
import { ScoreMeter } from "@/components/ScoreMeter";
import { RatingBadge } from "@/components/Badges";

export const dynamic = "force-dynamic";

export default function ContractorsPage() {
  const summaries = summarizeAll(audits, contractors, subRegions);
  const latest = new Map(
    latestByContractor(summaries).map((s) => [s.contractorId, s]),
  );

  return (
    <div className="stack">
      {subRegions.map((sr) => (
        <section className="card" key={sr.id}>
          <h2>{sr.name}</h2>
          <p className="sub">Latest quarterly EHSS review per contractor</p>
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Contractor</th>
                <th>Latest audit</th>
                <th>Score</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {contractors
                .filter((c) => c.subRegionId === sr.id)
                .map((c) => {
                  const s = latest.get(c.id);
                  return (
                    <tr key={c.id}>
                      <td>{c.code}</td>
                      <td>
                        <Link href={`/contractors/${c.id}`}>{c.name}</Link>
                      </td>
                      <td>
                        {s ? quarterLabel(s.quarter) : (
                          <span style={{ color: "var(--muted)" }}>
                            none finalized
                          </span>
                        )}
                      </td>
                      <td>{s ? <ScoreMeter score={s.total} /> : "—"}</td>
                      <td>{s ? <RatingBadge rating={s.rating} /> : "—"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
