"use client";

import { useMemo, useState } from "react";
import { useEhss } from "@/lib/ehss/store";
import {
  ContractorBarChart,
  RATING_KEY,
} from "@/components/charts/ContractorBarChart";
import { ContractorPanel } from "@/components/ContractorPanel";
import { ProblemPanel } from "@/components/ProblemPanel";
import { FloatingPanel } from "@/components/FloatingPanel";
import { quarterLabel, quarterOf } from "@/lib/ehss/model";
import { contractorLabel } from "@/lib/ehss/mock";
import {
  TIMEFRAMES,
  contractorProblems,
  contractorStats,
  findingHistories,
  findingMovement,
  problemEvidence,
  problemPeer,
  summarizeAll,
  timeframeById,
  type ProblemRow,
  type TimeframeId,
} from "@/lib/ehss/summaries";

/**
 * The dashboard is one chart.
 *
 * Everything that used to be a second card is now behind the bars: select a
 * contractor for its ranked problems, select a problem for the evidence. On
 * a desktop the whole thing is one screen with nothing to scroll — the
 * chart sizes itself to whatever height is left over, and each drill-down
 * level is a fixed box that caps its own list rather than growing.
 */
export function DashboardClient() {
  const { subRegions, contractors, audits } = useEhss();

  const [subRegionId, setSubRegionId] = useState("all");
  const [timeframe, setTimeframe] = useState<TimeframeId>("last4");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [problem, setProblem] = useState<ProblemRow | null>(null);

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

  const selected = stats.find((s) => s.contractorId === selectedId) ?? null;

  /** The selected contractor's reviews and their source audits. */
  const selectedWindow = useMemo(() => {
    if (!selected) return { summaries: [], audits: [] };
    const ids = new Set(selected.audits.map((a) => a.id));
    return {
      summaries: selected.audits,
      audits: scopedAudits.filter((a) => ids.has(a.id)),
    };
  }, [selected, scopedAudits]);

  const problems = useMemo(
    () =>
      selected
        ? contractorProblems(selectedWindow.summaries, selectedWindow.audits, 6)
        : [],
    [selected, selectedWindow],
  );

  /** What is stuck and what moved for this contractor — the positive half
   * of the story, which an audit report usually drops. */
  const movement = useMemo(
    () =>
      findingMovement(
        selected
          ? findingHistories(selectedWindow.summaries, selectedWindow.audits)
          : [],
      ),
    [selected, selectedWindow],
  );

  const evidence = useMemo(
    () =>
      problem
        ? problemEvidence(
            problem,
            selectedWindow.summaries,
            selectedWindow.audits,
            8,
          )
        : [],
    [problem, selectedWindow],
  );

  /** The same problem measured across every contractor in scope — a gap
   * everyone shares is a programme problem, not a contractor one. */
  const peer = useMemo(
    () => (problem ? problemPeer(problem, summaries, scopedAudits) : null),
    [problem, summaries, scopedAudits],
  );

  /** Problem counts per contractor, for the bar tooltips. */
  const problemCounts = useMemo(() => {
    const out = new Map<string, number>();
    for (const s of stats) {
      const ids = new Set(s.audits.map((a) => a.id));
      out.set(
        s.contractorId,
        contractorProblems(
          s.audits,
          scopedAudits.filter((a) => ids.has(a.id)),
          99,
        ).length,
      );
    }
    return out;
  }, [stats, scopedAudits]);

  const currentQuarter = quarterOf(new Date());
  const activeInScope = inScope.filter((c) => c.active);
  const reviewedThisQuarter = new Set(
    audits
      .filter((a) => a.quarter === currentQuarter && a.status !== "draft")
      .map((a) => a.contractorId),
  );
  const outstanding = activeInScope.filter(
    (c) => !reviewedThisQuarter.has(c.id),
  ).length;

  const scored = stats.filter((s) => s.avgScore !== null);
  const programAvg =
    scored.length > 0
      ? Math.round(
          (scored.reduce((sum, s) => sum + s.avgScore!, 0) / scored.length) * 10,
        ) / 10
      : null;

  const closePanel = () => {
    setSelectedId(null);
    setProblem(null);
  };

  return (
    <div className="board">
      <div className="board-bar">
        <label className="board-field">
          <span>Sub-region</span>
          <select
            value={subRegionId}
            onChange={(e) => {
              setSubRegionId(e.target.value);
              closePanel();
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
        <label className="board-field">
          <span>Timeframe</span>
          <select
            value={timeframe}
            onChange={(e) => {
              setTimeframe(e.target.value as TimeframeId);
              closePanel();
            }}
          >
            {TIMEFRAMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="board-check">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => {
              setIncludeInactive(e.target.checked);
              closePanel();
            }}
          />
          Include inactive
        </label>

        <div className="board-readout">
          <span>
            <strong>{programAvg === null ? "—" : `${programAvg.toFixed(1)}%`}</strong>
            programme average
          </span>
          <span>
            <strong>{stats.length}</strong>
            contractors
          </span>
          <span className={outstanding > 0 ? "is-warn" : undefined}>
            <strong>{outstanding}</strong>
            {quarterLabel(currentQuarter)} reviews outstanding
          </span>
        </div>
      </div>

      <div className="board-chart">
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
            problems: problemCounts.get(s.contractorId) ?? 0,
          }))}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setProblem(null);
          }}
        />
      </div>

      <div className="board-key">
        {RATING_KEY.map((k) => (
          <span key={k.label}>
            <i style={{ background: k.varName }} />
            {k.label}
          </span>
        ))}
        <span className="board-hint">Select a bar for its problems</span>
      </div>

      {selected && (
        <FloatingPanel
          title={
            problem
              ? problem.label
              : contractorLabel({
                  name: selected.contractorName,
                  code: selected.contractorCode,
                })
          }
          subtitle={
            problem
              ? contractorLabel({
                  name: selected.contractorName,
                  code: selected.contractorCode,
                })
              : `${selected.subRegionName} · ${timeframeById(timeframe).label} · ${selected.audits.length} review${selected.audits.length === 1 ? "" : "s"}`
          }
          onBack={problem ? () => setProblem(null) : undefined}
          onClose={closePanel}
        >
          {problem ? (
            <ProblemPanel problem={problem} evidence={evidence} peer={peer} />
          ) : (
            <ContractorPanel
              stats={selected}
              problems={problems}
              movement={movement}
              onOpenProblem={setProblem}
            />
          )}
        </FloatingPanel>
      )}
    </div>
  );
}
