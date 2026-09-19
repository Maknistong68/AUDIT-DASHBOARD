"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useEhss } from "@/lib/ehss/store";
import { StatTile } from "@/components/StatTile";
import { ScoreMeter } from "@/components/ScoreMeter";
import {
  ContractorBarChart,
  RATING_KEY,
} from "@/components/charts/ContractorBarChart";
import { ContractorDrilldown } from "@/components/ContractorDrilldown";
import { ContractorSparkGrid } from "@/components/charts/ContractorSparkGrid";
import { ObservationTrendLines } from "@/components/charts/ObservationTrendLines";
import { DomainGapHeatmap } from "@/components/charts/DomainGapHeatmap";
import { CriticalRiskBars } from "@/components/charts/CriticalRiskBars";
import { FloatingPanel } from "@/components/FloatingPanel";
import { formatScore } from "@/lib/format";
import {
  OBSERVATION_BY_CODE,
  quarterLabel,
  quarterOf,
  ratingFor,
} from "@/lib/ehss/model";
import { contractorLabel } from "@/lib/ehss/mock";
import { CRITICAL_RISKS } from "@/lib/ehss/critical-risks";
import { bandFor } from "@/lib/ehss/bands";
import {
  TIMEFRAMES,
  areaTrends,
  collectObservations,
  contractorSeriesByQuarter,
  contractorStats,
  finalized,
  criticalRiskStats,
  domainGapMatrix,
  observationTrendByQuarter,
  summarizeAll,
  timeframeById,
  topIssues,
  weakestSubSections,
  type TimeframeId,
} from "@/lib/ehss/summaries";

export function DashboardClient() {
  const { subRegions, contractors, audits } = useEhss();

  const [subRegionId, setSubRegionId] = useState("all");
  const [timeframe, setTimeframe] = useState<TimeframeId>("last4");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const inScope = useMemo(
    () =>
      contractors.filter(
        (c) =>
          (subRegionId === "all" || c.subRegionId === subRegionId) &&
          (includeInactive || c.active),
      ),
    [contractors, subRegionId, includeInactive],
  );
  const scopeIds = useMemo(() => new Set(inScope.map((c) => c.id)), [inScope]);

  const scopedAudits = useMemo(
    () => audits.filter((a) => scopeIds.has(a.contractorId)),
    [audits, scopeIds],
  );

  const summaries = useMemo(
    () => summarizeAll(scopedAudits, contractors, subRegions),
    [scopedAudits, contractors, subRegions],
  );

  const stats = useMemo(
    () => contractorStats(summaries, timeframe),
    [summaries, timeframe],
  );

  /** Audit ids inside the current window — every panel below is scoped to them. */
  const windowAuditIds = useMemo(
    () => new Set(stats.flatMap((s) => s.audits.map((a) => a.id))),
    [stats],
  );
  const windowAudits = useMemo(
    () => scopedAudits.filter((a) => windowAuditIds.has(a.id)),
    [scopedAudits, windowAuditIds],
  );
  const windowSummaries = useMemo(
    () => summaries.filter((s) => windowAuditIds.has(s.id)),
    [summaries, windowAuditIds],
  );

  const observations = useMemo(
    () => collectObservations(windowAudits, contractors),
    [windowAudits, contractors],
  );

  const scored = stats.filter((s) => s.avgScore !== null);
  const programAvg =
    scored.length > 0
      ? Math.round(
          (scored.reduce((sum, s) => sum + s.avgScore!, 0) / scored.length) * 10,
        ) / 10
      : null;

  // Quarterly obligation: every active contractor needs a review each quarter.
  const currentQuarter = quarterOf(new Date());
  const activeInScope = inScope.filter((c) => c.active);
  const reviewedThisQuarter = new Set(
    audits
      .filter((a) => a.quarter === currentQuarter && a.status !== "draft")
      .map((a) => a.contractorId),
  );
  const covered = activeInScope.filter((c) =>
    reviewedThisQuarter.has(c.id),
  ).length;

  const selected = stats.find((s) => s.contractorId === selectedId) ?? null;
  const selectedIssues = useMemo(() => {
    if (!selected) return [];
    const ids = new Set(selected.audits.map((a) => a.id));
    return topIssues(
      windowAudits.filter((a) => ids.has(a.id)),
      5,
    );
  }, [selected, windowAudits]);

  const selectedAreas = useMemo(() => {
    if (!selected) return [];
    const ids = new Set(selected.audits.map((a) => a.id));
    return areaTrends(windowSummaries.filter((s) => ids.has(s.id)))
      .filter((a) => a.gap !== null && a.gap > 0)
      .sort((a, b) => b.gap! - a.gap!)
      .slice(0, 5);
  }, [selected, windowSummaries]);

  const observationTrend = useMemo(
    () => observationTrendByQuarter(observations),
    [observations],
  );
  const gapMatrix = useMemo(
    () => domainGapMatrix(observations),
    [observations],
  );
  const crcStats = useMemo(
    () =>
      criticalRiskStats(windowSummaries)
        .filter((r) => r.avg !== null)
        .sort((a, b) => a.avg! - b.avg!),
    [windowSummaries],
  );
  const crcOutOfScope = CRITICAL_RISKS.filter(
    (r) => !crcStats.some((s) => s.id === r.id),
  );

  const contractorLines = useMemo(
    () => contractorSeriesByQuarter(windowSummaries),
    [windowSummaries],
  );

  const weakest = weakestSubSections(windowSummaries, 6);
  const timeframeLabel = timeframeById(timeframe).label;

  return (
    <div className="stack">
      <div className="filter-row">
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Sub-region</span>
          <select
            value={subRegionId}
            onChange={(e) => {
              setSubRegionId(e.target.value);
              setSelectedId(null);
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
          <span>Timeframe</span>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as TimeframeId)}
          >
            {TIMEFRAMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => {
              setIncludeInactive(e.target.checked);
              setSelectedId(null);
            }}
          />
          Include inactive contractors
        </label>
      </div>

      <div className="kpi-row">
        <StatTile
          label="Average score"
          value={formatScore(programAvg)}
          hint={timeframeLabel.toLowerCase()}
          tone={bandFor(programAvg)?.id}
        />
        <StatTile
          label="Rating"
          value={ratingFor(programAvg) ?? "—"}
          tone={bandFor(programAvg)?.id}
        />
        <StatTile
          label="Reviews in scope"
          value={String(finalized(windowSummaries).length)}
          hint={`${stats.length} contractor${stats.length === 1 ? "" : "s"}`}
          tone="neutral"
        />
        <StatTile
          label={`${quarterLabel(currentQuarter)} coverage`}
          value={`${covered}/${activeInScope.length}`}
          hint={
            covered === activeInScope.length
              ? "all active contractors reviewed"
              : `${activeInScope.length - covered} review${activeInScope.length - covered === 1 ? "" : "s"} outstanding`
          }
          tone={covered === activeInScope.length ? "compliant" : "moderate"}
        />
      </div>

      <section className="card">
        <h2>Contractor scores — {timeframeLabel.toLowerCase()}</h2>
        <p className="sub">
          {includeInactive ? "All" : "Active"} contractors in scope. Select a
          bar to see that contractor&apos;s trend, section performance and top
          issues for this timeframe.
        </p>
        <ContractorBarChart
          data={stats.map((s) => ({
            id: s.contractorId,
            label: contractorLabel({
              name: s.contractorName,
              code: s.contractorCode,
            }),
            value: s.avgScore,
            reviews: s.audits.length,
            rating: s.rating,
            delta: s.delta,
          }))}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <div className="rating-key">
          {RATING_KEY.map((k) => (
            <span key={k.label}>
              <i style={{ background: k.varName }} />
              {k.label}
            </span>
          ))}
        </div>
      </section>

      {selected && (
        <FloatingPanel
          title={contractorLabel({
            name: selected.contractorName,
            code: selected.contractorCode,
          })}
          subtitle={`${selected.subRegionName} · ${timeframeLabel} · ${selected.audits.length} review${selected.audits.length === 1 ? "" : "s"}`}
          onClose={() => setSelectedId(null)}
        >
          <ContractorDrilldown
            stats={selected}
            issues={selectedIssues}
            priorityAreas={selectedAreas}
          />
        </FloatingPanel>
      )}

      <section className="card">
        <h2>Score trajectories</h2>
        <p className="sub">
          One panel per contractor on a shared scale — where each is heading
          across the quarters in scope. Select a panel for the detail.
        </p>
        <ContractorSparkGrid
          quarters={contractorLines.quarters}
          series={contractorLines.series}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </section>

      <section className="card">
        <h2>Where the gaps are — SHEW pillar against gap type</h2>
        <p className="sub">
          {gapMatrix.total} findings in scope. Environment and Welfare have
          scores but no checklist yet, so they carry no findings.
        </p>
        <DomainGapHeatmap matrix={gapMatrix} />
      </section>

      <section className="card">
        <h2>Critical Risk Control — by hazardous work</h2>
        <p className="sub">
          The CRC focus audit, ranked worst first. Each contractor is scored
          only on the hazards its scope of work involves, so a hazard outside
          scope is excluded rather than counted as zero. Bars start at 60%
          and the tick marks the 90% target. Select a hazard for the
          contractors behind it.
          {crcOutOfScope.length > 0 && (
            <>
              {" "}
              Not in any contractor&apos;s scope this timeframe:{" "}
              {crcOutOfScope.map((r) => r.label).join(", ")}.
            </>
          )}
        </p>
        <CriticalRiskBars stats={crcStats} />
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Observation trends</h2>
          <p className="sub">
            What is driving the gaps, quarter by quarter ({observations.length}{" "}
            in scope)
          </p>
          <ObservationTrendLines
            quarters={observationTrend.quarters}
            series={observationTrend.series}
          />
        </section>

        <section className="card">
          <h2>Weakest sub-sections</h2>
          <p className="sub">Lowest average across the reviews in scope</p>
          {weakest.length === 0 ? (
            <div className="chart-empty">No finalized reviews in scope.</div>
          ) : (
            <table className="data">
              <tbody>
                {weakest.map((w) => (
                  <tr key={w.code}>
                    <td style={{ width: 44 }}>
                      <strong>{w.code}</strong>
                    </td>
                    <td>{w.title}</td>
                    <td style={{ width: 150 }}>
                      <ScoreMeter score={w.avg} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="sub" style={{ marginTop: 12 }}>
            <Link href="/findings">Open the findings register →</Link>
          </p>
        </section>
      </div>

    </div>
  );
}
