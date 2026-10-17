"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FloatingPanel } from "@/components/FloatingPanel";
import { ContractorView } from "@/components/board/ContractorView";
import { AreaView } from "@/components/board/AreaView";
import {
  Card,
  Delta,
  GoLink,
  ReviewFeed,
  SectionChips,
  StatTile,
  TargetGoals,
  Watchlist,
} from "@/components/board/Bento";
import { ProvenanceNote } from "@/components/ProvenanceNote";
import { ProgrammeTrendChart } from "@/components/charts/ProgrammeTrendChart";
import { ScoreColumns } from "@/components/charts/ScoreColumns";
import { CHECKLIST } from "@/lib/ehss/checklist";
import { flattenChecklist } from "@/lib/ehss/scoring";
import { useEhss } from "@/lib/ehss/store";
import { quarterLabel } from "@/lib/ehss/model";
import { bandColor } from "@/lib/ehss/bands";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { formatScore } from "@/lib/format";
import {
  boardBySubRegion,
  collectObservations,
  finalized,
  issueBreakdown,
  latestQuarter,
  programmeKpis,
  programmeTrend,
  quartersOnRecord,
  recentReviews,
  sectionMoves,
  sectionStanding,
  scoredDisciplines,
  stickyAreas,
  summarizeAll,
  type AreaStanding,
  type BoardRow,
  type EvidenceRow,
} from "@/lib/ehss/summaries";

const FLAT = flattenChecklist(CHECKLIST);

/**
 * The board — a bento of tiles over one quarter.
 *
 * Three readers open it: the project director of each sub-region and the
 * H&S team, and they open it to COMPARE CONTRACTORS, most recent quarter
 * first. So the quarter is a control at the top and everything below it
 * answers one question each: which way the programme is going, how the
 * contractors stack up in it, what has been audited lately, and who needs
 * the next conversation. Anything deeper is a click away rather than on the
 * page — the drill-down panels below are unchanged.
 *
 * Every tile is its own surface and its own scale. It is NOT one
 * viewport-height chart: that rule made thirteen contractors into enormous
 * bars with everything else squeezed around them.
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
    () => (includeInactive ? summaries : summaries.filter((s) => s.contractorActive)),
    [summaries, includeInactive],
  );

  const quarters = useMemo(() => quartersOnRecord(scoped), [scoped]);
  const shown = quarter ?? latestQuarter(scoped);

  const panels = useMemo(
    () => boardBySubRegion(scoped, shown, subRegions),
    [scoped, shown, subRegions],
  );
  const kpi = useMemo(() => programmeKpis(scoped, shown), [scoped, shown]);
  const trend = useMemo(() => programmeTrend(scoped), [scoped]);
  const moves = useMemo(() => sectionMoves(scoped, shown), [scoped, shown]);
  /** What the headline figure is an average OF. With one discipline on
   * record the scorecard weights collapse to it, and a board headed "EHSS
   * performance" would be ranking Health & Safety without saying so. */
  const basis = useMemo(() => scoredDisciplines(scoped, shown), [scoped, shown]);
  const feed = useMemo(
    () => recentReviews(scoped.filter((s) => s.quarter === shown), 5),
    [scoped, shown],
  );

  /** Every contractor in the quarter, worst first — the columns, and the
   * first three of them are the watchlist. */
  const league = useMemo(
    () =>
      panels
        .flatMap((p) => p.rows)
        .sort((a, b) => (a.score ?? 101) - (b.score ?? 101)),
    [panels],
  );

  const pick = (row: BoardRow) => {
    setSelected(row);
    setArea(null);
  };
  const pickById = (contractorId: string) => {
    const row = league.find((r) => r.contractorId === contractorId);
    if (row) pick(row);
  };

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
    if (!area)
      return { programme: null as number | null, questions: [], evidence: [] as EvidenceRow[] };
    const programmeAreas = stickyAreas(scoped);
    const questions = FLAT.filter((f) => (f.subSection ?? f.section) === area.code).map(
      (f) => f.question,
    );
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
    return <div className="bn" />;
  }

  return (
    <div className="bn">
      <header className="bn-head">
        <div className="bn-head-id">
          <h1>EHSS performance</h1>
          <p>
            Quarterly contractor audits across {subRegions.length} sub-regions
            {basis.singleDiscipline && (
              <>
                {" · "}
                <b className="bn-basis">
                  {basis.names[0]} only — {Math.round((1 - basis.weight) * 100)}%
                  of the scorecard is not yet scored
                </b>
              </>
            )}
          </p>
        </div>
        <div className="bn-head-tools">
          <div className="bn-seg" role="group" aria-label="Quarter">
            {quarters.map((q) => (
              <button
                key={q}
                type="button"
                aria-pressed={q === shown}
                onClick={() => setQuarter(q)}
              >
                {quarterLabel(q)}
              </button>
            ))}
          </div>
          <label className="bn-toggle">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            <span>Inactive</span>
          </label>
          <div className="bn-avg">
            <span>Programme</span>
            <strong style={{ color: bandColor(kpi.average) }}>
              {formatScore(kpi.average)}
            </strong>
            <Delta value={kpi.delta} />
          </div>
        </div>
      </header>

      <div className="bn-grid">
        <Card
          title="Programme trend"
          note={`Each faint line is one of ${trend.contractors.length} contractors`}
          wide
          className="bn-trend"
          action={<GoLink href="/contractors" label="Open contractor trajectories" />}
        >
          <SectionChips moves={moves} />
          <ProgrammeTrendChart trend={trend} />
        </Card>

        <Card
          title="This quarter"
          note={`${league.length} contractor${league.length === 1 ? "" : "s"}, weakest first`}
          className="bn-league"
        >
          <div className="bn-league-hero">
            <strong>{formatScore(kpi.average)}</strong>
            <Delta value={kpi.delta} />
          </div>
          <ScoreColumns
            rows={league}
            selectedId={selected?.contractorId ?? null}
            onSelect={pick}
          />
        </Card>

        <Card
          title="Latest reviews"
          note={`${finalized(scoped).length} on record`}
          className="bn-reviews"
          action={<GoLink href="/audits" label="Open all reviews" />}
        >
          <ReviewFeed reviews={feed} onSelect={pickById} />
        </Card>

        <StatTile
          className="bn-s1"
          label="Below target"
          value={
            <>
              {kpi.belowTarget}
              <em className="bn-of"> of {kpi.contractors}</em>
            </>
          }
          note={`contractors under ${TARGET_SCORE}%`}
        />

        <StatTile
          className="bn-s2"
          label="Weakest area"
          value={kpi.weakestArea ? formatScore(kpi.weakestArea.score) : "—"}
          tone={bandColor(kpi.weakestArea?.score ?? null)}
          note={kpi.weakestArea?.title ?? "—"}
        />

        <Card title="Against target" note={`Sub-regions vs ${TARGET_SCORE}%`} className="bn-target">
          <TargetGoals panels={panels} programme={kpi.average} />
        </Card>

        <Card
          title="Watchlist"
          note="Weakest three this quarter"
          className="bn-watchc"
          action={<GoLink href="/findings" label="Open findings analysis" />}
        >
          <Watchlist rows={league.slice(0, 3)} onSelect={pick} />
        </Card>

        <StatTile
          className="bn-s3"
          label="Recurring gaps"
          value={kpi.recurringAreas}
          note="areas weak two audits running"
        />

        <StatTile
          className="bn-s4"
          label="Reviews"
          value={league.length}
          note={shown ? `finalized in ${quarterLabel(shown)}` : "no quarter on record"}
        />

        <Link className="bn-action" href="/audits">
          <span aria-hidden>+</span>
          Start a review
        </Link>
      </div>

      <ProvenanceNote compact />

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
