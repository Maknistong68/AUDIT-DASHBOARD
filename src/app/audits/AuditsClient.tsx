"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEhss } from "@/lib/ehss/store";
import { contractorLabel } from "@/lib/ehss/mock";
import { AuditStatusBadge, RatingBadge } from "@/components/Badges";
import { formatDate, formatScore } from "@/lib/format";
import {
  nextQuarter,
  previousQuarter,
  quarterLabel,
  quarterOf,
} from "@/lib/ehss/model";
import { knownQuarters, summarizeAll } from "@/lib/ehss/summaries";

/** Quarter options: everything on record, plus the previous, current and
 * next quarter — so the coming quarter's reviews can be opened ahead of
 * time, which is when the schedule is actually planned. */
function quarterOptions(existing: string[]): string[] {
  const current = quarterOf(new Date());
  const set = new Set([
    ...existing,
    previousQuarter(current),
    current,
    nextQuarter(current),
  ]);
  return [...set].sort((a, b) => b.localeCompare(a));
}

export function AuditsClient({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const { subRegions, contractors, audits, createAudit } = useEhss();
  const [quarter, setQuarter] = useState(quarterOf(new Date()));

  const summaries = useMemo(
    () => summarizeAll(audits, contractors, subRegions),
    [audits, contractors, subRegions],
  );
  const byId = useMemo(
    () => new Map(summaries.map((s) => [s.id, s])),
    [summaries],
  );

  const options = quarterOptions(knownQuarters(audits));
  const activeContractors = contractors.filter((c) => c.active);

  /** One row per active contractor for the selected quarter. */
  const coverage = activeContractors.map((c) => {
    const audit = audits.find(
      (a) => a.contractorId === c.id && a.quarter === quarter,
    );
    return { contractor: c, summary: audit ? byId.get(audit.id) : undefined };
  });
  const done = coverage.filter(
    (r) => r.summary && r.summary.status !== "draft",
  ).length;

  const start = (contractorId: string) => {
    const id = createAudit({
      contractorId,
      quarter,
      auditDate: new Date().toISOString().slice(0, 10),
    });
    router.push(`/audits/${id}`);
  };

  const history = [...summaries].sort(
    (a, b) =>
      b.quarter.localeCompare(a.quarter) ||
      a.contractorName.localeCompare(b.contractorName),
  );

  return (
    <div className="stack">
      <section className="card">
        <div className="drilldown-head">
          <div>
            <h2>Quarterly review coverage</h2>
            <p className="sub">
              Every active contractor needs one review per quarter —{" "}
              <strong>
                {done} of {activeContractors.length} complete
              </strong>{" "}
              for {quarterLabel(quarter)}
            </p>
          </div>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Quarter</span>
            <select value={quarter} onChange={(e) => setQuarter(e.target.value)}>
              {options.map((q) => (
                <option key={q} value={q}>
                  {quarterLabel(q)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <table className="data">
          <thead>
            <tr>
              <th>Contractor</th>
              <th>Sub-region</th>
              <th>Status</th>
              <th className="num">Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {coverage.map(({ contractor, summary }) => (
              <tr key={contractor.id}>
                <td>
                  <Link href={`/contractors/${contractor.id}`}>
                    {contractorLabel(contractor)}
                  </Link>
                </td>
                <td>
                  {subRegions.find((s) => s.id === contractor.subRegionId)?.name}
                </td>
                <td>
                  {summary ? (
                    <AuditStatusBadge status={summary.status} />
                  ) : (
                    <span className="coverage-missing">Not started</span>
                  )}
                </td>
                <td className="num">
                  {summary && summary.status !== "draft"
                    ? formatScore(summary.overall)
                    : "—"}
                </td>
                <td className="num">
                  {summary ? (
                    <Link href={`/audits/${summary.id}`}>
                      {summary.status === "draft" ? "Continue" : "Open"} →
                    </Link>
                  ) : canCreate ? (
                    <button
                      className="primary"
                      type="button"
                      onClick={() => start(contractor.id)}
                    >
                      Start review
                    </button>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {activeContractors.length === 0 && (
          <div className="chart-empty">
            No active contractors — reactivate one on the Contractors page.
          </div>
        )}
      </section>

      <section className="card">
        <h2>All reviews</h2>
        <p className="sub">
          {history.length} quarterly reviews on record, newest first
        </p>
        <table className="data">
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Contractor</th>
              <th>Sub-region</th>
              <th>Date</th>
              <th>Status</th>
              <th className="num">Score</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {history.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/audits/${s.id}`}>{quarterLabel(s.quarter)}</Link>
                </td>
                <td>
                  {contractorLabel({ name: s.contractorName, code: s.contractorCode })}
                </td>
                <td>{s.subRegionName}</td>
                <td>{formatDate(s.auditDate)}</td>
                <td>
                  <AuditStatusBadge status={s.status} />
                </td>
                <td className="num">
                  {s.status === "draft" ? "—" : formatScore(s.overall)}
                </td>
                <td>
                  {s.status === "draft" ? (
                    <span style={{ color: "var(--muted)" }}>in progress</span>
                  ) : (
                    <RatingBadge rating={s.rating} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
