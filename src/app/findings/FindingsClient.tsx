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
import { collectObservations } from "@/lib/ehss/summaries";
import { DOMAINS, DOMAIN_BY_ID } from "@/lib/ehss/domains";

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
