"use client";

import { useState } from "react";
import { RatingBadge } from "@/components/Badges";
import { ChecklistForm } from "@/components/audit/ChecklistForm";
import type { Responses } from "@/components/audit/QuestionRow";
import { formatScore } from "@/lib/format";
import { ratingFor, type EhssAudit } from "@/lib/ehss/model";
import {
  DISCIPLINES,
  type DisciplineId,
  type DisciplineScores,
} from "@/lib/ehss/disciplines";
import {
  CRITICAL_RISKS,
  crcScore,
  type CriticalRiskId,
  type CriticalRiskScores,
} from "@/lib/ehss/critical-risks";
import { DOMAIN_BY_ID } from "@/lib/ehss/domains";
import {
  SCOPE_BY_ID,
  hasChecklist,
  questionCount,
  responsesForScope,
  riskScopeId,
  riskScore,
  scopeProgress,
  scopesFor,
} from "@/lib/ehss/scopes";

/**
 * A panel's headline figure — absent when there is nothing behind it.
 *
 * `RatingBadge` prints a dash for an unscored value, which is right inside a
 * table cell and wrong here: stacked under a score that is also a dash it
 * reads as two broken fields. A panel with no score shows no score.
 */
function PanelScore({ score }: { score: number | null }) {
  if (score === null) return null;
  return (
    <div style={{ textAlign: "right" }}>
      <div className="panel-score" style={{ fontSize: 28 }}>
        {formatScore(score)}
      </div>
      <RatingBadge rating={ratingFor(score)} />
    </div>
  );
}

/** Where a discipline's figure came from, in the fewest words that are true. */
export type Source = "checklist" | "areas" | "hazards" | "recorded" | "none";

const SOURCE_LABEL: Record<Source, string> = {
  checklist: "from checklist",
  areas: "from area points",
  hazards: "from hazards",
  recorded: "recorded",
  none: "not scored",
};

/**
 * The scorecard, and the way into each discipline.
 *
 * Five disciplines, five audits. H&S has its 81-question checklist, the next
 * three will each have their own, and Critical Risk is a focus inspection
 * made of fourteen separate hazard checklists. So this is a tab strip, not a
 * grid of five number fields: a discipline is a place you go to do its
 * audit, not a box you type a figure into. Each tab carries its weight, its
 * score and where that score came from, because "72.3%" means different
 * things depending on whether anyone answered a question to get it.
 */
export function Scorecard({
  scores,
  sources,
  overall,
  active,
  onSelect,
}: {
  scores: DisciplineScores;
  sources: Record<DisciplineId, Source>;
  overall: number | null;
  active: DisciplineId;
  onSelect: (id: DisciplineId) => void;
}) {
  return (
    <div className="discipline-panel">
      <div className="drilldown-head">
        <div>
          <h3 className="panel-title" style={{ margin: 0 }}>
            Scorecard
          </h3>
          <p className="sub" style={{ margin: "2px 0 0" }}>
            Five weighted disciplines. Select one to run or review its audit.
          </p>
        </div>
        <PanelScore score={overall} />
      </div>
      <div className="dsc-tabs" role="tablist" aria-label="Discipline">
        {DISCIPLINES.map((d) => {
          const score = scores[d.id];
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={active === d.id}
              onClick={() => onSelect(d.id)}
            >
              <span className="dsc-name">
                {d.shortName}
                <em>{Math.round(d.weight * 100)}%</em>
              </span>
              <strong>{formatScore(score ?? null)}</strong>
              <span className={`dsc-src is-${sources[d.id]}`}>
                {SOURCE_LABEL[sources[d.id]]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Critical Risk Control — the focus inspection.
 *
 * Fourteen hazards, each with ITS OWN checklist, and the discipline score is
 * the combination of them (owner, 2026-10-17). A contractor is audited only
 * against the hazards its scope of work involves: a firm with no marine
 * works is never scored on Working on or Near Water, and scoring it zero
 * would be a lie about the contractor rather than a fact about the work. So
 * "in scope" is an explicit choice and an out-of-scope hazard is ABSENT from
 * the mean, never a zero.
 *
 * A hazard's score comes from its own checklist once that checklist is
 * complete, and from a recorded figure until then — the same precedence the
 * H&S form uses between its answers and its area points, for the same
 * reason. Thirteen of the fourteen checklists are still to be supplied; a
 * hazard without one simply has no expander, which is the absence of a
 * thing rather than a note apologising for it.
 */
export function CriticalRiskPanel({
  audit,
  canEdit,
  onSaveRisks,
  onSaveResponses,
}: {
  audit: EhssAudit;
  canEdit: boolean;
  onSaveRisks: (risks: CriticalRiskScores) => void;
  onSaveResponses: (scopeId: string, responses: Responses) => void;
}) {
  const [draft, setDraft] = useState<CriticalRiskScores>(audit.criticalRisks);
  const [open, setOpen] = useState<CriticalRiskId | null>(null);
  const [saved, setSaved] = useState(false);

  const inScope = CRITICAL_RISKS.filter((r) => draft[r.id] !== undefined);
  const derived = crcScore(draft);

  const setScore = (id: CriticalRiskId, raw: string) => {
    const value = raw === "" ? 0 : Number(raw);
    setSaved(false);
    setDraft((prev) => ({
      ...prev,
      [id]: Number.isNaN(value) ? 0 : Math.max(0, Math.min(100, value)),
    }));
  };

  const toggle = (id: CriticalRiskId, on: boolean) => {
    setSaved(false);
    setDraft((prev) => {
      const next = { ...prev };
      if (on) next[id] = prev[id] ?? 0;
      else delete next[id];
      return next;
    });
  };

  return (
    <div className="discipline-panel">
      <div className="drilldown-head">
        <div>
          <h3 className="panel-title" style={{ margin: 0 }}>
            Critical Risk Control — focus inspection
          </h3>
          <p className="sub" style={{ margin: "2px 0 0" }}>
            {CRITICAL_RISKS.length} hazards, each with its own checklist. Score
            only the hazardous work this contractor actually does —{" "}
            {inScope.length} in scope; the rest are excluded from the average
            rather than scored zero.
          </p>
        </div>
        <PanelScore score={derived} />
      </div>

      <ul className="risk-list">
        {CRITICAL_RISKS.map((risk) => {
          const scopeId = riskScopeId(risk.id);
          const scope = SCOPE_BY_ID[scopeId]!;
          const scoped = draft[risk.id] !== undefined;
          const { source } = riskScore(audit, risk.id);
          const progress = scopeProgress(audit, scopeId);
          const expandable = hasChecklist(scope);
          const isOpen = open === risk.id;
          return (
            <li key={risk.id} className={scoped ? undefined : "is-out"}>
              <div className="risk-row">
                <input
                  type="checkbox"
                  checked={scoped}
                  disabled={!canEdit}
                  aria-label={`${risk.label} in scope`}
                  onChange={(e) => toggle(risk.id, e.target.checked)}
                />
                <span className="risk-name">
                  <b>{risk.label}</b>
                  <em>
                    {DOMAIN_BY_ID[risk.domain].label}
                    {expandable &&
                      ` · ${progress.answered}/${questionCount(scope)} answered`}
                  </em>
                </span>
                {scoped ? (
                  source === "checklist" ? (
                    <span className="risk-score">
                      <b>{formatScore(progress.score)}</b>
                      <em>from checklist</em>
                    </span>
                  ) : (
                    <input
                      className="risk-input"
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      disabled={!canEdit}
                      value={draft[risk.id] ?? ""}
                      aria-label={`${risk.label} score`}
                      onChange={(e) => setScore(risk.id, e.target.value)}
                    />
                  )
                ) : (
                  <span className="risk-out">not in scope</span>
                )}
                {expandable && scoped && (
                  <button
                    type="button"
                    className="risk-open"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : risk.id)}
                  >
                    {isOpen ? "Close" : "Checklist"}
                  </button>
                )}
              </div>
              {expandable && scoped && isOpen && (
                <ChecklistForm
                  scope={scope}
                  responses={responsesForScope(audit, scopeId)}
                  canEdit={canEdit}
                  onChange={(next) => onSaveResponses(scopeId, next)}
                />
              )}
            </li>
          );
        })}
      </ul>

      {canEdit && (
        <p>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              onSaveRisks(draft);
              setSaved(true);
            }}
          >
            {saved ? "Saved" : "Save hazard scores"}
          </button>
        </p>
      )}
    </div>
  );
}

/**
 * Environment, Security and Worker Welfare — one checklist each, when they
 * arrive.
 *
 * Until then the discipline carries a recorded figure, which is how the
 * programme already works: these three are audited, the scores exist, and
 * the only thing missing is the question-by-question record. The number
 * field is therefore the real screen, not a placeholder — and the moment
 * `scopes.ts` carries that discipline's sections, the checklist appears
 * below it and takes over the score once complete.
 */
export function DisciplineScorePanel({
  discipline,
  audit,
  recorded,
  canEdit,
  onSaveScore,
  onSaveResponses,
}: {
  discipline: DisciplineId;
  audit: EhssAudit;
  recorded: number | undefined;
  canEdit: boolean;
  onSaveScore: (value: number | undefined) => void;
  onSaveResponses: (scopeId: string, responses: Responses) => void;
}) {
  const meta = DISCIPLINES.find((d) => d.id === discipline)!;
  const scope = scopesFor(discipline)[0]!;
  const [draft, setDraft] = useState<string>(
    recorded === undefined ? "" : String(recorded),
  );
  const [saved, setSaved] = useState(false);
  const progress = scopeProgress(audit, scope.id);
  const live = hasChecklist(scope);

  return (
    <div className="discipline-panel">
      <div className="drilldown-head">
        <div>
          <h3 className="panel-title" style={{ margin: 0 }}>
            {meta.name}
          </h3>
          <p className="sub" style={{ margin: "2px 0 0" }}>
            {Math.round(meta.weight * 100)}% of the scorecard
            {live
              ? ` · ${progress.answered}/${progress.total} answered`
              : " · scored from its own audit until its checklist is added"}
          </p>
        </div>
        <PanelScore
          score={live && progress.complete ? progress.score : (recorded ?? null)}
        />
      </div>

      <div className="discipline-grid">
        <label className="field">
          <span>Recorded score</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            disabled={!canEdit}
            placeholder="—"
            value={draft}
            onChange={(e) => {
              setSaved(false);
              setDraft(e.target.value);
            }}
          />
        </label>
      </div>
      {canEdit && (
        <p>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              const n = draft.trim() === "" ? undefined : Number(draft);
              onSaveScore(n === undefined || Number.isNaN(n) ? undefined : n);
              setSaved(true);
            }}
          >
            {saved ? "Saved" : "Save score"}
          </button>
        </p>
      )}

      {live && (
        <ChecklistForm
          scope={scope}
          responses={responsesForScope(audit, scope.id)}
          canEdit={canEdit}
          onChange={(next) => onSaveResponses(scope.id, next)}
        />
      )}
    </div>
  );
}
