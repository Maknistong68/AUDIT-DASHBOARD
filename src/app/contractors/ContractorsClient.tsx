"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useEhss } from "@/lib/ehss/store";
import { contractorLabel } from "@/lib/ehss/mock";
import { RatingBadge } from "@/components/Badges";
import { formatScore } from "@/lib/format";
import { quarterLabel } from "@/lib/ehss/model";
import {
  DISCIPLINES,
  TARGET_SCORE,
  ordinal,
  rankScores,
} from "@/lib/ehss/disciplines";
import { contractorStats, summarizeAll } from "@/lib/ehss/summaries";

/** Colour a score cell by distance from target, the way the source
 * scorecard highlights weak and strong columns. */
function cellTone(score: number | null | undefined): string {
  if (score === null || score === undefined) return "";
  if (score >= TARGET_SCORE) return "cell-good";
  if (score < 70) return "cell-weak";
  return "";
}

/**
 * The master scorecard: one row per contractor, a column per discipline, the
 * weighted average, and the programme ranking — the same shape as the Excel
 * scorecard, in this app's design.
 */
export function ContractorsClient({ canManage }: { canManage: boolean }) {
  const { subRegions, contractors, audits, setContractorActive } = useEhss();
  const [showInactive, setShowInactive] = useState(true);

  const summaries = useMemo(
    () => summarizeAll(audits, contractors, subRegions),
    [audits, contractors, subRegions],
  );
  const latest = useMemo(
    () => contractorStats(summaries, "latest"),
    [summaries],
  );
  const statsById = new Map(latest.map((s) => [s.contractorId, s]));

  // Rank across every active contractor, independent of the grouping below.
  const ranked = latest.filter((s) => s.active);
  const rankValues = rankScores(ranked.map((s) => s.avgScore));
  const rankById = new Map(
    ranked.map((s, i) => [s.contractorId, rankValues[i] ?? null]),
  );

  const quarter = latest[0]?.latestQuarter ?? null;

  return (
    <div className="stack">
      <div className="filter-row">
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive contractors
        </label>
      </div>

      {subRegions.map((sr) => {
        const rows = contractors.filter(
          (c) => c.subRegionId === sr.id && (showInactive || c.active),
        );
        if (rows.length === 0) return null;
        return (
          <section className="card" key={sr.id}>
            <h2>{sr.name}</h2>
            <p className="sub">
              Latest quarterly scorecard
              {quarter ? ` · ${quarterLabel(quarter)}` : ""} · weighted average
              across the five disciplines
            </p>
            <div className="table-scroll">
              <table className="data scorecard">
                <thead>
                  <tr>
                    <th>Contractor</th>
                    {DISCIPLINES.map((d) => (
                      <th key={d.id} className="num">
                        {d.shortName}
                        <div className="th-weight">
                          {Math.round(d.weight * 100)}%
                        </div>
                      </th>
                    ))}
                    <th className="num">Average</th>
                    <th>Rating</th>
                    <th>Rank</th>
                    {canManage && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const s = statsById.get(c.id);
                    const rank = rankById.get(c.id) ?? null;
                    return (
                      <tr key={c.id} style={{ opacity: c.active ? 1 : 0.6 }}>
                        <td>
                          <Link href={`/contractors/${c.id}`}>
                            {contractorLabel(c)}
                          </Link>
                          {!c.active && (
                            <span className="inactive-tag">inactive</span>
                          )}
                        </td>
                        {DISCIPLINES.map((d) => {
                          const value = s?.disciplineAverages.find(
                            (x) => x.id === d.id,
                          )?.avg;
                          return (
                            <td
                              key={d.id}
                              className={`num ${cellTone(value)}`}
                            >
                              {value === null || value === undefined
                                ? "—"
                                : `${value.toFixed(1)}%`}
                            </td>
                          );
                        })}
                        <td className="num strong">
                          {formatScore(s?.avgScore ?? null)}
                        </td>
                        <td>
                          <RatingBadge rating={s?.rating ?? null} />
                        </td>
                        <td>
                          {rank === null ? (
                            "—"
                          ) : rank <= 3 ? (
                            <strong>{ordinal(rank)}</strong>
                          ) : (
                            ordinal(rank)
                          )}
                        </td>
                        {canManage && (
                          <td className="num">
                            <button
                              className="ghost"
                              type="button"
                              onClick={() => setContractorActive(c.id, !c.active)}
                            >
                              {c.active ? "Deactivate" : "Reactivate"}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {canManage && (
        <div className="notice">
          Deactivate a contractor when its project completes: the scorecard
          history stays, but it leaves the active ranking and no longer counts
          toward quarterly review coverage. Reactivate at any time.
        </div>
      )}
    </div>
  );
}
