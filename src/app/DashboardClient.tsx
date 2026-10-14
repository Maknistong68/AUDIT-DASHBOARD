"use client";

import { useMemo, useState } from "react";
import { FloatingPanel } from "@/components/FloatingPanel";
import { Kpis } from "@/components/board/Kpis";
import { SubRegionPanel } from "@/components/board/SubRegionPanel";
import { ContractorView } from "@/components/board/ContractorView";
import { AreaView } from "@/components/board/AreaView";
import { CHECKLIST } from "@/lib/ehss/checklist";
import { flattenChecklist } from "@/lib/ehss/scoring";
import { useEhss } from "@/lib/ehss/store";
import { quarterLabel } from "@/lib/ehss/model";
import {
  boardBySubRegion,
  collectObservations,
  finalized,
  issueBreakdown,
  latestQuarter,
  programmeKpis,
  quartersOnRecord,
  sectionStanding,
  stickyAreas,
  summarizeAll,
  type AreaStanding,
  type BoardRow,
  type EvidenceRow,
} from "@/lib/ehss/summaries";

const FLAT = flattenChecklist(CHECKLIST);

/**
 * The board.
 *
 * Three readers — the project director of each sub-region and the H&S team —
 * open this to COMPARE CONTRACTORS, most recent quarter first. The layout is
 * that sentence: a row of plain numbers, then one panel per sub-region, then
 * everything else behind a click.
 *
 * It is deliberately NOT one viewport-height chart any more. That rule made
 * thirteen contractors into enormous bars with everything else squeezed
 * around them; the chart now owns its panel and the page scrolls like a page.
 */
export function DashboardClient() {
  const { contractors, subRegions, audits, hydrated } = useEhss();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [quarter, setQuarter] = useState<string | null>(null);
  const [selected, setSelected] = useState<BoardRow | null>(null);
  const [area, setArea] = useState<AreaStanding | null>(null);

  const summaries = useMemo(
    () => summarizeAll(audits, contractors, subRegions),
    [audits, contractors, subRegions],
  );
  const scoped = useMemo(
    () =>
      includeInactive
        ? summaries
        : summaries.filter((s) => s.contractorActive),
    [summaries, includeInactive],
  );

  const quarters = useMemo(() => quartersOnRecord(scoped), [scoped]);
  const shown = quarter ?? latestQuarter(scoped);

  const panels = useMemo(
    () => boardBySubRegion(scoped, shown, subRegions),
    [scoped, shown, subRegions],
  );
  const kpi = useMemo(() => programmeKpis(scoped, shown), [scoped, shown]);

  /** Everything the drill-down needs for the selected contractor. */
  const detail = useMemo(() => {
    if (!selected) return null;
    const reviews = finalized(scoped)
      .filter((s) => s.contractorId === selected.contractorId)
      .sort((a, b) => a.quarter.localeCompare(b.quarter));
    const own = audits.filter((a) => a.contractorId === selected.contractorId);
    return {
      reviews,
      sections: sectionStanding(reviews),
      areas: stickyAreas(reviews),
      causes: issueBreakdown(collectObservations(own, contractors)),
      subRegionName: reviews[0]?.subRegionName ?? "",
    };
  }, [selected, scoped, audits, contractors]);

  /** Programme mean for the open area, so the detail has something to sit
   * against rather than a bare number. */
  const areaContext = useMemo(() => {
    if (!area) return { programme: null as number | null, questions: [], evidence: [] as EvidenceRow[] };
    const programmeAreas = stickyAreas(scoped);
    const questions = FLAT.filter(
      (f) => (f.subSection ?? f.section) === area.code,
    ).map((f) => f.question);
    const rows = selected
      ? collectObservations(
          audits.filter((a) => a.contractorId === selected.contractorId),
          contractors,
        ).filter((r) => (r.subSectionTitle ?? `Section ${r.sectionCode}`) === area.title)
      : [];
    const evidence: EvidenceRow[] = rows.map((r) => ({
      quarter: r.quarter,
      code: r.questionCode,
      text: r.questionText,
      score: null,
      answer: r.answer,
      issues: r.issues,
      weight: null,
    }));
    return {
      programme: programmeAreas.find((a) => a.code === area.code)?.score ?? null,
      questions,
      evidence,
    };
  }, [area, scoped, selected, audits, contractors]);

  const closeAll = () => {
    setSelected(null);
    setArea(null);
  };

  if (!hydrated && summaries.length === 0) {
    return <div className="bd" />;
  }

  return (
    <div className="bd">
      <div className="bd-head">
        <div className="bd-title">
          <h1>Contractor performance</h1>
          <p>{shown ? quarterLabel(shown) : "No reviews on record"}</p>
        </div>
        <div className="bd-controls">
          <label className="bd-select">
            <span>Quarter</span>
            <select
              value={shown ?? ""}
              onChange={(e) => setQuarter(e.target.value)}
            >
              {quarters.map((q) => (
                <option key={q} value={q}>
                  {quarterLabel(q)}
                </option>
              ))}
            </select>
          </label>
          <label className="bd-toggle">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            <span>Include inactive</span>
          </label>
        </div>
      </div>

      <Kpis kpi={kpi} />

      <div className="bd-panels">
        {panels.map((panel) => (
          <SubRegionPanel
            key={panel.subRegionId}
            panel={panel}
            selectedId={selected?.contractorId ?? null}
            onSelect={(row) => {
              setSelected(row);
              setArea(null);
            }}
          />
        ))}
      </div>

      {selected && detail && (
        <FloatingPanel
          title={area ? area.title : selected.label}
          subtitle={
            area
              ? `${selected.label} · ${detail.subRegionName}`
              : `${detail.subRegionName} · ${shown ? quarterLabel(shown) : ""}`
          }
          onBack={area ? () => setArea(null) : undefined}
          onClose={closeAll}
        >
          {area ? (
            <AreaView
              area={area}
              contractorLabel={selected.label}
              programmeScore={areaContext.programme}
              questions={areaContext.questions}
              evidence={areaContext.evidence}
            />
          ) : (
            <ContractorView
              label={selected.label}
              subRegionName={detail.subRegionName}
              reviews={detail.reviews}
              sections={detail.sections}
              areas={detail.areas}
              causes={detail.causes}
              onOpenArea={setArea}
            />
          )}
        </FloatingPanel>
      )}
    </div>
  );
}
