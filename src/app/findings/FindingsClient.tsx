"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { contractorLabel, quarterLabel } from "@/lib/ehss/model";
import {
  GAP_CATEGORIES,
  ISSUE_BY_CODE,
} from "@/lib/ehss/issues";
import { useEhss } from "@/lib/ehss/store";
import { AnalysisTabs } from "@/components/AnalysisTabs";
import { RecordedOnlyNote } from "@/components/RecordedOnlyNote";
import {
  closedFindings,
  collectObservations,
  criticalRiskStats,
  findingHistories,
  recurringFindings,
  domainGapMatrix,
  issueTrendByQuarter,
  summarizeAll,
} from "@/lib/ehss/summaries";
import { DOMAINS, DOMAIN_BY_ID } from "@/lib/ehss/domains";
import { CRITICAL_RISKS } from "@/lib/ehss/critical-risks";
import { DomainGapHeatmap } from "@/components/charts/DomainGapHeatmap";
import { CriticalRiskBars } from "@/components/charts/CriticalRiskBars";
import { IssueTrendGrid } from "@/components/charts/IssueTrendGrid";

const GAP_OPTIONS = GAP_CATEGORIES;

export function FindingsClient() {
  const { subRegions, contractors, audits } = useEhss();
  const observations = useMemo(
    () => collectObservations(audits, contractors),
    [audits, contractors],
  );

  const [subRegionId, setSubRegionId] = useState("all");
  const [contractorId, setContractorId] = useState("all");
  const [observation, setObservation] = useState("all");
  const [domain, setDomain] = useState("all");
  const [track, setTrack] = useState<"stuck" | "closed">("stuck");

  /** Programme-wide analysis, scoped by the same filters as the register
   * below — the dashboard is one chart, so these live where the findings
   * they summarize are. */
  const scopedAudits = useMemo(
    () =>
      audits.filter((a) => {
        const c = contractors.find((x) => x.id === a.contractorId);
        if (!c) return false;
        return (
          (subRegionId === "all" || c.subRegionId === subRegionId) &&
          (contractorId === "all" || c.id === contractorId)
        );
      }),
    [audits, contractors, subRegionId, contractorId],
  );

  const scopedSummaries = useMemo(
    () => summarizeAll(scopedAudits, contractors, subRegions),
    [scopedAudits, contractors, subRegions],
  );

  const contractorOptions =
    subRegionId === "all"
      ? contractors
      : contractors.filter((c) => c.subRegionId === subRegionId);

  const rows = useMemo(
    () =>
      observations
        .filter(
          (o) =>
            (subRegionId === "all" || o.subRegionId === subRegionId) &&
            (contractorId === "all" || o.contractorId === contractorId) &&
            (observation === "all" || o.issues.includes(observation as never)) &&
            (domain === "all" || o.domain === domain),
        )
        .sort(
          (a, b) =>
            b.quarter.localeCompare(a.quarter) ||
            a.contractorName.localeCompare(b.contractorName) ||
            a.questionCode.localeCompare(b.questionCode),
        ),
    [observations, subRegionId, contractorId, observation, domain],
  );

  const gapMatrix = useMemo(() => domainGapMatrix(rows), [rows]);
  const observationTrend = useMemo(
    () => issueTrendByQuarter(rows),
    [rows],
  );
  const crcStats = useMemo(
    () =>
      criticalRiskStats(scopedSummaries)
        .filter((r) => r.avg !== null)
        .sort((a, b) => a.avg! - b.avg!),
    [scopedSummaries],
  );
  const crcOutOfScope = CRITICAL_RISKS.filter(
    (r) => !crcStats.some((c) => c.id === r.id),
  );

  /** The same finding across quarters: what will not shift, and what the
   * follow-up actually closed. */
  const histories = useMemo(
    () => findingHistories(scopedSummaries, scopedAudits),
    [scopedSummaries, scopedAudits],
  );
  /** True when nothing in scope has per-question answers, so every
   * question-level card below is empty for a reason worth stating. */
  const areaScoresOnly =
    scopedSummaries.length > 0 &&
    scopedSummaries.every((s) => s.fromAreaScores);

  const stuck = useMemo(() => recurringFindings(histories, 12), [histories]);
  const closed = useMemo(() => closedFindings(histories, 12), [histories]);
  const tracked = track === "stuck" ? stuck : closed;

  return (
    <div className="stack">
      <AnalysisTabs />
      {areaScoresOnly && (
        <RecordedOnlyNote what="The gap register, the pillar heat-map, the cause trends and the recurrence tracking below fill in from the first review entered through the app." />
      )}
      <div className="filter-row">
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Sub-region</span>
          <select
            value={subRegionId}
            onChange={(e) => {
              setSubRegionId(e.target.value);
              setContractorId("all");
            }}
          >
            <option value="all">All sub-regions</option>
            {subRegions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Contractor</span>
          <select
            value={contractorId}
            onChange={(e) => setContractorId(e.target.value)}
          >
            <option value="all">All contractors</option>
            {contractorOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {contractorLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>SHEW pillar</span>
          <select value={domain} onChange={(e) => setDomain(e.target.value)}>
            <option value="all">All pillars</option>
            {DOMAINS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Classification</span>
          <select
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
          >
            <option value="all">All classifications</option>
            {GAP_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.code} — {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="card">
        <h2>Where the gaps are — SHEW pillar against issue category</h2>
        <p className="sub">
          {gapMatrix.total} findings in scope. Environment and Welfare have
          scores but no checklist yet, so they carry no findings.
        </p>
        <DomainGapHeatmap matrix={gapMatrix} />
      </section>

      <section className="card">
        <h2>What is driving the gaps</h2>
        <p className="sub">
          Each issue category quarter by quarter, across {rows.length} finding
          {rows.length === 1 ? "" : "s"} in scope.
        </p>
        <IssueTrendGrid
          quarters={observationTrend.quarters}
          series={observationTrend.series}
        />
      </section>

      <section className="card">
        <div className="track-head">
          <div>
            <h2>Findings across quarters</h2>
            <p className="sub">
              {track === "stuck"
                ? `${stuck.length} finding${stuck.length === 1 ? "" : "s"} open three reviews running or closed and back — these need an owner, not another observation.`
                : `${closed.length} finding${closed.length === 1 ? "" : "s"} answered Full in the latest review after being open — the follow-up worked.`}
            </p>
          </div>
          <div className="track-toggle" role="group" aria-label="Which findings">
            <button
              type="button"
              aria-pressed={track === "stuck"}
              onClick={() => setTrack("stuck")}
            >
              Keeps coming back
            </button>
            <button
              type="button"
              aria-pressed={track === "closed"}
              onClick={() => setTrack("closed")}
            >
              Fixed since last review
            </button>
          </div>
        </div>

        {tracked.length === 0 ? (
          <div className="chart-empty">
            {track === "stuck"
              ? "Nothing has been open three reviews running in this scope."
              : "Nothing closed in the latest review in this scope."}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Contractor</th>
                  <th>Question</th>
                  <th>Area</th>
                  <th>Pillar</th>
                  <th>{track === "stuck" ? "Open for" : "Closed in"}</th>
                </tr>
              </thead>
              <tbody>
                {tracked.map((f) => (
                  <tr key={f.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {contractorLabel({
                        name: f.contractorName,
                        code: f.contractorCode,
                      })}
                    </td>
                    <td>
                      <strong>{f.questionCode}</strong>
                      <div className="issue-text">{f.questionText}</div>
                    </td>
                    <td>{f.subSectionTitle ?? `Section ${f.sectionCode}`}</td>
                    <td>{DOMAIN_BY_ID[f.domain].label}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {track === "stuck" ? (
                        f.status === "reopened" ? (
                          <span className="track-flag is-back">came back</span>
                        ) : (
                          <span className="track-flag is-stuck">
                            {f.openStreak} reviews
                          </span>
                        )
                      ) : (
                        <span className="track-flag is-fixed">
                          {quarterLabel(f.closedIn!)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Critical Risk Control — by hazardous work</h2>
        <p className="sub">
          The CRC focus audit, ranked worst first. Each contractor is scored
          only on the hazards its scope of work involves, so a hazard outside
          scope is excluded rather than counted as zero. Bars start at 60% and
          the tick marks the 90% target. Select a hazard for the contractors
          behind it.
          {/* With no hazard scored anywhere, "not in scope" would read as a
              scoping decision somebody made. No CRC audit has been run. */}
          {crcStats.length > 0 && crcOutOfScope.length > 0 && (
            <>
              {" "}
              Not in any contractor&apos;s scope here:{" "}
              {crcOutOfScope.map((r) => r.label).join(", ")}.
            </>
          )}
        </p>
        {crcStats.length === 0 ? (
          <div className="recorded-note">
            <strong>No Critical Risk Control audit on record.</strong> The
            imported reviews cover Health &amp; Safety only. CRC is a separate
            focus audit over the {CRITICAL_RISKS.length} hazardous-work items,
            scored per contractor against the hazards its scope involves — it
            fills in once those audits are entered.
          </div>
        ) : (
          <CriticalRiskBars stats={crcStats} />
        )}
      </section>

      <section className="card">
        <h2>Gap observations</h2>
        <p className="sub">
          Every Partial or No answer across finalized audits, with its
          standardized classification ({rows.length} in scope)
        </p>
        {rows.length === 0 ? (
          <div className="chart-empty">No observations in scope.</div>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Quarter</th>
                  <th>Contractor</th>
                  <th>Pillar</th>
                  <th>Question</th>
                  <th>Area</th>
                  <th>Answer</th>
                  <th>Classification</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={`${o.auditId}-${o.questionCode}`}>
                    <td>
                      <Link href={`/audits/${o.auditId}`}>
                        {quarterLabel(o.quarter)}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/contractors/${o.contractorId}`}>
                        {o.contractorName}
                      </Link>
                    </td>
                    <td>{DOMAIN_BY_ID[o.domain].label}</td>
                    <td>
                      <strong>{o.questionCode}</strong>
                    </td>
                    <td>{o.subSectionTitle ?? `Section ${o.sectionCode}`}</td>
                    <td>{o.answer === "no" ? "No" : "Partial"}</td>
                    <td>
                      <span className="issue-chips">
                        {o.issues.map((c) => (
                          <i key={c} title={ISSUE_BY_CODE[c].description}>
                            {ISSUE_BY_CODE[c].label}
                          </i>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
