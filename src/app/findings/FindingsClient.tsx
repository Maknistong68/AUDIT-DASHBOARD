"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  OBSERVATION_BY_CODE,
  OBSERVATION_OPTIONS,
  quarterLabel,
} from "@/lib/ehss/model";
import { useEhss } from "@/lib/ehss/store";
import { contractorLabel } from "@/lib/ehss/mock";
import {
  collectObservations,
  criticalRiskStats,
  domainGapMatrix,
  observationTrendByQuarter,
  summarizeAll,
} from "@/lib/ehss/summaries";
import { DOMAINS, DOMAIN_BY_ID } from "@/lib/ehss/domains";
import { CRITICAL_RISKS } from "@/lib/ehss/critical-risks";
import { DomainGapHeatmap } from "@/components/charts/DomainGapHeatmap";
import { CriticalRiskBars } from "@/components/charts/CriticalRiskBars";
import { ObservationTrendLines } from "@/components/charts/ObservationTrendLines";

const GAP_OPTIONS = OBSERVATION_OPTIONS.filter((o) => o.gap);

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
            (observation === "all" || o.observation === observation) &&
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
    () => observationTrendByQuarter(rows),
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

  return (
    <div className="stack">
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

      <div className="grid-2">
        <section className="card">
          <h2>Where the gaps are — SHEW pillar against gap type</h2>
          <p className="sub">
            {gapMatrix.total} findings in scope. Environment and Welfare have
            scores but no checklist yet, so they carry no findings.
          </p>
          <DomainGapHeatmap matrix={gapMatrix} />
        </section>

        <section className="card">
          <h2>Observation trends</h2>
          <p className="sub">
            What is driving the gaps, quarter by quarter ({rows.length} in
            scope)
          </p>
          <ObservationTrendLines
            quarters={observationTrend.quarters}
            series={observationTrend.series}
          />
        </section>
      </div>

      <section className="card">
        <h2>Critical Risk Control — by hazardous work</h2>
        <p className="sub">
          The CRC focus audit, ranked worst first. Each contractor is scored
          only on the hazards its scope of work involves, so a hazard outside
          scope is excluded rather than counted as zero. Bars start at 60% and
          the tick marks the 90% target. Select a hazard for the contractors
          behind it.
          {crcOutOfScope.length > 0 && (
            <>
              {" "}
              Not in any contractor&apos;s scope here:{" "}
              {crcOutOfScope.map((r) => r.label).join(", ")}.
            </>
          )}
        </p>
        <CriticalRiskBars stats={crcStats} />
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
                      {o.observation} — {OBSERVATION_BY_CODE[o.observation].label}
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
