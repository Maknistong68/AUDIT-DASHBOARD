"use client";

import { useEffect, useMemo, useState } from "react";
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
import { downloadCsv, exportName } from "@/lib/export/csv";
import {
  boardBySubRegion,
  collectObservations,
  finalized,
  issueBreakdown,
  latestQuarter,
  programmeKpis,
  programmeTrend,
  quarterCoverage,
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
  /**
   * Whose patch. The organisation IS two sub-regions with a director each,
   * and the board showed both with no way to narrow to one — so each
   * director read a programme average that is half somebody else's
   * contractors. Remembered per browser, because a director opens their own
   * patch every time and picking it again each morning is a tax.
   */
  const [region, setRegion] = useState<string | null>(null);
  const [regionReady, setRegionReady] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("ehss-region");
      if (saved) setRegion(saved);
    } catch {
      // Blocked storage: the board still works, it just forgets.
    }
    setRegionReady(true);
  }, []);
  const chooseRegion = (id: string | null) => {
    setRegion(id);
    try {
      if (id) window.localStorage.setItem("ehss-region", id);
      else window.localStorage.removeItem("ehss-region");
    } catch {
      /* see above */
    }
  };
  const [quarter, setQuarter] = useState<string | null>(null);
  const [selected, setSelected] = useState<BoardRow | null>(null);
  const [area, setArea] = useState<AreaStanding | null>(null);
  /** Who the open contractor is being read against. */
  const [compareId, setCompareId] = useState<string | null>(null);

  const summaries = useMemo(
    () => summarizeAll(audits, contractors, subRegions),
    [audits, contractors, subRegions],
  );
  const scoped = useMemo(() => {
    const byActive = includeInactive
      ? summaries
      : summaries.filter((s) => s.contractorActive);
    return region === null
      ? byActive
      : byActive.filter((s) => s.subRegionId === region);
  }, [summaries, includeInactive, region]);
  /** The programme, whatever the director is looking at — so a sub-region
   * figure always has the whole against which to read it. */
  const programme = useMemo(
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
  const coverage = useMemo(
    () => quarterCoverage(scoped, contractors, shown, region),
    [scoped, contractors, shown, region],
  );
  /** The programme average, for a sub-region to be read against. */
  const programmeKpi = useMemo(
    () => programmeKpis(programme, shown),
    [programme, shown],
  );

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

  /**
   * The current view as a file. No export existed, so the only way a figure
   * left this app was somebody retyping it — a second, unverified copy of
   * data the rest of this project works hard to keep checkable.
   *
   * It exports what is ON SCREEN, filters included, because a CSV that
   * silently holds more than the view it came from is how two people end up
   * arguing from the same filename.
   */
  const exportRows = () => {
    downloadCsv(exportName("contractors", shown), [
      ["Quarter", "Sub-region", "Contractor", "Score", "Band", "Change", "Areas below target", "Areas scored"],
      ...league.map((row) => {
        const summary = scoped.find(
          (x) => x.contractorId === row.contractorId && x.quarter === shown,
        );
        return [
          shown ?? "",
          summary?.subRegionName ?? "",
          row.label,
          row.score ?? "",
          summary?.rating ?? "",
          row.delta ?? "",
          row.areasBelow,
          row.areasScored,
        ];
      }),
    ]);
  };

  const pick = (row: BoardRow) => {
    setSelected(row);
    setArea(null);
    setCompareId(null);
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
    setCompareId(null);
  };

  /** The comparison contractor's areas, on the same quarters as the open
   * one so the two figures are answering the same question. */
  const compareAreas = useMemo(() => {
    if (!compareId) return {};
    const theirs = finalized(scoped)
      .filter((s) => s.contractorId === compareId)
      .sort((a, b) => a.quarter.localeCompare(b.quarter));
    return Object.fromEntries(
      stickyAreas(theirs).map((a) => [a.code, a.score]),
    ) as Record<string, number | null>;
  }, [compareId, scoped]);

  if (!hydrated && summaries.length === 0) {
    return <div className="bn" />;
  }

  return (
    <div className="bn">
      <header className="bn-head">
        <div className="bn-head-id">
          <h1>EHSS performance</h1>
          <p>
            {region === null
              ? `Quarterly contractor audits across ${subRegions.length} sub-regions`
              : `${subRegions.find((sr) => sr.id === region)?.name ?? ""} · programme average ${formatScore(programmeKpi.average)}`}
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
          <div className="bn-seg" role="group" aria-label="Sub-region">
            <button
              type="button"
              aria-pressed={region === null}
              onClick={() => chooseRegion(null)}
            >
              All
            </button>
            {subRegions.map((sr) => (
              <button
                key={sr.id}
                type="button"
                aria-pressed={region === sr.id}
                onClick={() => chooseRegion(sr.id)}
              >
                {sr.name.replace(/^Sub Region /, "SR ")}
              </button>
            ))}
          </div>
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
          <button type="button" className="bn-export" onClick={exportRows}>
            Export CSV
          </button>
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
          note={`${trend.quarters.length} quarter${trend.quarters.length === 1 ? "" : "s"} on record · each faint line is one of ${trend.contractors.length} contractors`}
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

        {/* Coverage, not a review count. "11 reviews" says nothing about the
            two contractors nobody audited, and those two are exactly the
            ones nobody is thinking about. */}
        <StatTile
          className="bn-s4"
          label="Audited"
          value={
            <>
              {coverage.audited}
              <em className="bn-of"> of {coverage.expected}</em>
            </>
          }
          note={
            coverage.missing.length === 0
              ? shown
                ? `every contractor, ${quarterLabel(shown)}`
                : "no quarter on record"
              : `not audited: ${coverage.missing.map((m) => m.label).join(", ")}`
          }
          tone={coverage.missing.length > 0 ? "var(--status-warning)" : undefined}
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
              peers={league
                .filter((r) => r.contractorId !== selected.contractorId)
                .map((r) => ({ contractorId: r.contractorId, label: r.label }))}
              compareId={compareId}
              onCompare={setCompareId}
              compareAreas={compareAreas}
              onOpenArea={setArea}
            />
          )}
        </FloatingPanel>
      )}
    </div>
  );
}
