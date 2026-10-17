"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEhss } from "@/lib/ehss/store";
import { AuditStatusBadge, RatingBadge } from "@/components/Badges";
import { formatDate, formatScore } from "@/lib/format";
import {
  auditableQuarters,
  contractorLabel,
  quarterLabel,
} from "@/lib/ehss/model";
import { knownQuarters, summarizeAll } from "@/lib/ehss/summaries";

export function AuditsClient({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const { subRegions, contractors, audits, createAudit } = useEhss();
  /**
   * Opens on the latest quarter that HAS reviews, not on today's.
   *
   * It used to open on the current quarter, which in October 2026 led with
   * "0 of 13 complete for Q4 2026" — true, and the first thing anyone saw,
   * and it reads as a programme that has done nothing rather than one
   * mid-quarter. The picker still reaches today; it just does not start on
   * an empty page.
   */
  const [quarter, setQuarter] = useState<string | null>(null);
  /**
   * Which reviews the history table lists.
   *
   * Submitting used to set a status and tell nobody: the review left the
   * auditor's hands and appeared in no queue, so an approval happened when
   * somebody remembered rather than when something was waiting. "Awaiting
   * approval" is that queue, and it leads the filter when anything is in it.
   */
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "submitted" | "approved"
  >("all");

  const summaries = useMemo(
    () => summarizeAll(audits, contractors, subRegions),
    [audits, contractors, subRegions],
  );
  const byId = useMemo(
    () => new Map(summaries.map((s) => [s.id, s])),
    [summaries],
  );

  const known = knownQuarters(audits);
  const options = auditableQuarters(known);
  const latestWithReviews =
    [...known].sort((a, b) => b.localeCompare(a))[0] ?? options[0]!;
  const shown = quarter ?? latestWithReviews;
  const activeContractors = contractors.filter((c) => c.active);

  /** One row per active contractor for the selected quarter. */
  const coverage = activeContractors.map((c) => {
    const audit = audits.find(
      (a) => a.contractorId === c.id && a.quarter === shown,
    );
    return { contractor: c, summary: audit ? byId.get(audit.id) : undefined };
  });
  const done = coverage.filter(
    (r) => r.summary && r.summary.status !== "draft",
  ).length;

  const start = (contractorId: string) => {
    const id = createAudit({
      contractorId,
      quarter: shown,
      auditDate: new Date().toISOString().slice(0, 10),
    });
    router.push(`/audits/${id}`);
  };

  const history = [...summaries].sort(
    (a, b) =>
      b.quarter.localeCompare(a.quarter) ||
      a.contractorName.localeCompare(b.contractorName),
  );
  const counts = {
    draft: history.filter((s) => s.status === "draft").length,
    submitted: history.filter((s) => s.status === "submitted").length,
    approved: history.filter((s) => s.status === "approved").length,
  };
  const shownHistory =
    statusFilter === "all"
      ? history
      : history.filter((s) => s.status === statusFilter);

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
              for {quarterLabel(shown)}
            </p>
          </div>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Quarter</span>
            <select value={shown} onChange={(e) => setQuarter(e.target.value)}>
              {options.map((q) => (
                <option key={q} value={q}>
                  {quarterLabel(q)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="table-scroll">
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
        </div>
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
        <div className="status-filter" role="group" aria-label="Status">
          {(
            [
              ["all", `All ${history.length}`],
              ["submitted", `Awaiting approval ${counts.submitted}`],
              ["draft", `Draft ${counts.draft}`],
              ["approved", `Approved ${counts.approved}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={statusFilter === id}
              className={
                id === "submitted" && counts.submitted > 0 ? "is-waiting" : undefined
              }
              onClick={() => setStatusFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="table-scroll">
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
              {shownHistory.map((s) => (
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
        </div>
      </section>
    </div>
  );
}
