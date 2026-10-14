"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEhss } from "@/lib/ehss/store";
import { AuditStatusBadge, RatingBadge } from "@/components/Badges";
import { formatScore } from "@/lib/format";
import { CHECKLIST } from "@/lib/ehss/checklist";
import { scoreAreasAndAnswers } from "@/lib/ehss/scoring";
import { scoreChecklist } from "@/lib/ehss/summaries";
import {
  contractorLabel,
  previousQuarter,
  quarterLabel,
  quarterOf,
  ratingFor,
  type EhssAudit,
  type EhssAuditStatus,
  type EhssResponse,
  type RecordedAreaScores,
} from "@/lib/ehss/model";
import {
  DISCIPLINES,
  weightedOverall,
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
import { EhssAuditForm } from "./EhssAuditForm";
import type { UserRole } from "@/lib/types";

const STATUSES: EhssAuditStatus[] = ["draft", "submitted", "approved"];

const QUESTION_COUNT = CHECKLIST.reduce(
  (n, sec) => n + sec.subSections.reduce((m, ss) => m + ss.questions.length, 0),
  0,
);

/** The quarters a review may be dated to: the ones on record, plus the
 * current and previous one — never the next. An audit for a quarter nobody
 * has audited is a draft dated in the future. */
function quarterChoices(known: string[], own: string): string[] {
  const current = quarterOf(new Date());
  return [
    ...new Set([...known, previousQuarter(current), current, own]),
  ].sort((a, b) => b.localeCompare(a));
}

/**
 * The review's own details — when it was done, what it is numbered, which
 * quarter it counts for, and where it is in the draft/submitted/approved
 * sequence. Editable, because a transcribed review is as likely to carry a
 * typed date as a mis-keyed point.
 *
 * The contractor is not here. Moving a review to another contractor is not
 * an edit, it is two edits to two contractors' trends, and it would be made
 * by someone who had mis-read a row rather than by someone who meant it.
 */
function AuditMetaPanel({
  audit,
  quarters,
  canEdit,
  isAdmin,
  onSave,
  onStatus,
}: {
  audit: EhssAudit;
  quarters: string[];
  canEdit: boolean;
  isAdmin: boolean;
  onSave: (meta: Pick<EhssAudit, "auditDate" | "inspectionNo" | "quarter">) => void;
  onStatus: (status: EhssAuditStatus) => void;
}) {
  const [draft, setDraft] = useState({
    auditDate: audit.auditDate,
    inspectionNo: audit.inspectionNo,
    quarter: audit.quarter,
  });
  const [saved, setSaved] = useState(false);
  const changed =
    draft.auditDate !== audit.auditDate ||
    draft.inspectionNo !== audit.inspectionNo ||
    draft.quarter !== audit.quarter;

  const set = (field: keyof typeof draft, value: string) => {
    setSaved(false);
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="discipline-panel">
      <div className="drilldown-head">
        <h3 className="panel-title" style={{ margin: 0 }}>
          Review details
        </h3>
        <AuditStatusBadge status={audit.status} />
      </div>
      <div className="discipline-grid">
        <label className="field">
          <span>Quarter</span>
          <select
            disabled={!canEdit}
            value={draft.quarter}
            onChange={(e) => set("quarter", e.target.value)}
          >
            {quarters.map((q) => (
              <option key={q} value={q}>
                {quarterLabel(q)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Audit date</span>
          <input
            type="date"
            disabled={!canEdit}
            value={draft.auditDate}
            onChange={(e) => set("auditDate", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Inspection no.</span>
          <input
            type="text"
            disabled={!canEdit}
            value={draft.inspectionNo}
            onChange={(e) => set("inspectionNo", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Status</span>
          <select
            disabled={!canEdit}
            value={audit.status}
            onChange={(e) => onStatus(e.target.value as EhssAuditStatus)}
          >
            {STATUSES.filter((st) => st !== "approved" || isAdmin).map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </label>
      </div>
      {canEdit && (
        <p>
          <button
            className="ghost"
            type="button"
            disabled={!changed}
            onClick={() => {
              onSave(draft);
              setSaved(true);
            }}
          >
            {changed ? "Save details" : saved ? "Saved" : "Saved"}
          </button>
        </p>
      )}
    </div>
  );
}

/** Scores for the four disciplines without their own checklist, plus the
 * Health & Safety score the 81-question checklist produces. */
function DisciplinePanel({
  scores,
  checklistScore,
  hsSource,
  crcAuditScore,
  canEdit,
  onSave,
}: {
  scores: DisciplineScores;
  checklistScore: number | null;
  /** Where the Health & Safety figure came from — the 81-question checklist,
   * or the area points of a review imported from a sheet. Naming it matters:
   * the two are the same formula at different grains, and a reader asked to
   * act on the number is entitled to know which one they are looking at. */
  hsSource: "checklist" | "areas";
  crcAuditScore: number | null;
  canEdit: boolean;
  onSave: (scores: DisciplineScores) => void;
}) {
  const [draft, setDraft] = useState<DisciplineScores>(scores);
  const [saved, setSaved] = useState(false);

  const effective: DisciplineScores = {
    ...draft,
    hs: draft.hs ?? checklistScore ?? undefined,
    crc: draft.crc ?? crcAuditScore ?? undefined,
  };
  const overall = weightedOverall(effective);

  const set = (id: DisciplineId, raw: string) => {
    const value = raw === "" ? undefined : Number(raw);
    setSaved(false);
    setDraft((prev) => ({
      ...prev,
      [id]: value === undefined || Number.isNaN(value) ? undefined : value,
    }));
  };

  return (
    <div className="discipline-panel">
      <div className="drilldown-head">
        <div>
          <h3 className="panel-title" style={{ margin: 0 }}>
            Discipline scores
          </h3>
          <p className="sub" style={{ margin: "2px 0 0" }}>
            Health &amp; Safety comes from{" "}
            {hsSource === "areas"
              ? "the recorded area scores below"
              : "the checklist below"}{" "}
            and Critical Risk Control from the hazard scores; the other three
            are recorded from their own audits.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="panel-score" style={{ fontSize: 28 }}>
            {formatScore(overall)}
          </div>
          <RatingBadge rating={ratingFor(overall)} />
        </div>
      </div>
      <div className="discipline-grid">
        {DISCIPLINES.map((d) => (
          <label className="field" key={d.id}>
            <span>
              {d.name}{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                {Math.round(d.weight * 100)}%
              </span>
            </span>
            {d.detailed ? (
              <input
                type="text"
                readOnly
                value={
                  effective.hs === undefined
                    ? "not scored yet"
                    : `${effective.hs.toFixed(1)}% (${
                        hsSource === "areas" ? "recorded areas" : "checklist"
                      })`
                }
              />
            ) : d.id === "crc" && crcAuditScore !== null && draft.crc === undefined ? (
              <input
                type="text"
                readOnly
                value={`${crcAuditScore.toFixed(1)}% (hazard scores)`}
              />
            ) : (
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                disabled={!canEdit}
                value={draft[d.id] ?? ""}
                placeholder="—"
                onChange={(e) => set(d.id, e.target.value)}
              />
            )}
          </label>
        ))}
      </div>
      {canEdit && (
        <p>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              onSave(draft);
              setSaved(true);
            }}
          >
            {saved ? "Saved" : "Save discipline scores"}
          </button>
        </p>
      )}
    </div>
  );
}

/**
 * The Critical Risk Control focus audit: one score per hazardous-work item.
 * A hazard is only scored when the contractor's scope of work involves it —
 * "in scope" is an explicit checkbox rather than an empty field, so a hazard
 * the contractor genuinely does not do can never be confused with one the
 * auditor forgot.
 */
function CriticalRiskPanel({
  risks,
  canEdit,
  onSave,
}: {
  risks: CriticalRiskScores;
  canEdit: boolean;
  onSave: (risks: CriticalRiskScores) => void;
}) {
  const [draft, setDraft] = useState<CriticalRiskScores>(risks);
  const [saved, setSaved] = useState(false);

  const inScope = CRITICAL_RISKS.filter((r) => draft[r.id] !== undefined);
  const derived = crcScore(draft);
  // Nothing scored and nothing editable: the entry grid would be fourteen
  // rows of "not in scope", which reads as a scoping decision rather than
  // an audit that was never run.
  const unscored = inScope.length === 0 && !canEdit;

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

  if (unscored) {
    return (
      <div className="discipline-panel">
        <h3 className="panel-title" style={{ margin: 0 }}>
          Critical Risk Control — focus audit
        </h3>
        <p className="sub" style={{ margin: "4px 0 0" }}>
          Not run for this review.
        </p>
      </div>
    );
  }

  return (
    <div className="discipline-panel">
      <div className="drilldown-head">
        <div>
          <h3 className="panel-title" style={{ margin: 0 }}>
            Critical Risk Control — focus audit
          </h3>
          <p className="sub" style={{ margin: "2px 0 0" }}>
            Score only the hazardous work this contractor actually does.{" "}
            {inScope.length} of {CRITICAL_RISKS.length} hazard
            {inScope.length === 1 ? "" : "s"} in scope; the rest are excluded
            from the average rather than scored zero.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="panel-score" style={{ fontSize: 28 }}>
            {formatScore(derived)}
          </div>
          <RatingBadge rating={ratingFor(derived)} />
        </div>
      </div>
      <div className="table-scroll">
        <table className="data crc-entry">
          <thead>
            <tr>
              <th style={{ width: 80 }}>In scope</th>
              <th>Hazardous work</th>
              <th style={{ width: 90 }}>Pillar</th>
              <th style={{ width: 110 }} className="num">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {CRITICAL_RISKS.map((risk) => {
              const scoped = draft[risk.id] !== undefined;
              return (
                <tr key={risk.id} className={scoped ? undefined : "is-out"}>
                  <td>
                    <input
                      type="checkbox"
                      checked={scoped}
                      disabled={!canEdit}
                      aria-label={`${risk.label} in scope`}
                      onChange={(e) => toggle(risk.id, e.target.checked)}
                    />
                  </td>
                  <td>{risk.label}</td>
                  <td style={{ color: "var(--muted)" }}>
                    {DOMAIN_BY_ID[risk.domain].label}
                  </td>
                  <td className="num">
                    {scoped ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        disabled={!canEdit}
                        value={draft[risk.id] ?? ""}
                        onChange={(e) => setScore(risk.id, e.target.value)}
                      />
                    ) : (
                      <span style={{ color: "var(--muted)" }}>not in scope</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <p>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              onSave(draft);
              setSaved(true);
            }}
          >
            {saved ? "Saved" : "Save critical-risk scores"}
          </button>
        </p>
      )}
    </div>
  );
}

export function AuditDetailClient({
  auditId,
  role,
}: {
  auditId: string;
  role: UserRole | null;
}) {
  const router = useRouter();
  const {
    hydrated,
    contractors,
    subRegions,
    audits,
    saveResponses,
    saveAreaScores,
    saveAuditMeta,
    saveDisciplineScores,
    saveCriticalRisks,
    setAuditStatus,
    deleteAudit,
  } = useEhss();

  /**
   * An approved review is editable, but not by accident. The gate used to be
   * `status === "draft"`, which made a transcribed review permanently
   * read-only and left a mis-keyed point with nowhere to be fixed; a plain
   * open form would let a stray click rewrite a signed-off score instead.
   * One deliberate action in between is the whole of the difference.
   */
  const [unlocked, setUnlocked] = useState(false);

  const audit = audits.find((a) => a.id === auditId);
  /**
   * Every panel below seeds a `useState` from the audit, so each is keyed to
   * remount when the store finishes hydrating. The provider starts from the
   * recorded baseline so SSR and the first client render agree, and applies
   * the browser's saved edits a tick later — without this key the panels
   * would still be holding the baseline they were born with, and a saved
   * edit would read as lost the moment the page was reloaded.
   */
  const panelKey = `${auditId}-${hydrated}`;
  const quarters = useMemo(
    () => quarterChoices(audits.map((a) => a.quarter), audit?.quarter ?? ""),
    [audits, audit?.quarter],
  );

  if (!audit) {
    return (
      <div className="card">
        <h2>{hydrated ? "Review not found" : "Loading…"}</h2>
        {hydrated && (
          <p className="sub">
            <Link href="/audits">Back to reviews</Link>
          </p>
        )}
      </div>
    );
  }

  const contractor = contractors.find((c) => c.id === audit.contractorId);
  const subRegion = subRegions.find((s) => s.id === contractor?.subRegionId);
  const isAdmin = role === "admin";
  const mayEdit = isAdmin || role === "auditor";
  const canEdit = mayEdit && (audit.status === "draft" || unlocked);
  const checklist = scoreChecklist(audit);
  const checklistScore = checklist.total;
  const crcAuditScore = crcScore(audit.criticalRisks);
  /** Which source the H&S figure came from overall. Mixed is real now that
   * precedence is per area: an imported review being re-audited area by
   * area is scored from both until the last area changes hands. */
  const areaKeys = Object.keys(audit.areaScores ?? {});
  const answeredAny = Object.keys(audit.responses).length > 0;
  const hsSource: "checklist" | "areas" =
    areaKeys.length > 0 && !answeredAny ? "areas" : "checklist";

  return (
    <div className="stack">
      <section className="card">
        <div className="drilldown-head">
          <div>
            <h2 style={{ margin: 0 }}>
              {contractor ? contractorLabel(contractor) : "Contractor"} — EHSS
              Quarterly Review
            </h2>
            <p className="sub" style={{ margin: "4px 0 0" }}>
              {subRegion?.name} · {quarterLabel(audit.quarter)} ·{" "}
              {audit.inspectionNo}
              {contractor && !contractor.active && " · contractor inactive"}
              {audit.reportedTotal !== undefined && (
                <>
                  {" "}
                  · source sheet stated {audit.reportedTotal}%; this score is
                  calculated from its points
                </>
              )}
            </p>
          </div>
          {mayEdit && audit.status !== "draft" && (
            <button
              className="ghost"
              type="button"
              aria-pressed={unlocked}
              onClick={() => setUnlocked((on) => !on)}
            >
              {unlocked ? "Done editing" : "Edit this review"}
            </button>
          )}
        </div>

        <AuditMetaPanel
          key={`${panelKey}-meta`}
          audit={audit}
          quarters={quarters}
          canEdit={canEdit}
          isAdmin={isAdmin}
          onSave={(meta) => saveAuditMeta(audit.id, meta)}
          onStatus={(status) => setAuditStatus(audit.id, status)}
        />

        <DisciplinePanel
          key={`${panelKey}-disciplines`}
          scores={audit.disciplineScores}
          checklistScore={checklistScore}
          hsSource={hsSource}
          crcAuditScore={crcAuditScore}
          canEdit={canEdit}
          onSave={(scores) => saveDisciplineScores(audit.id, scores)}
        />

        <CriticalRiskPanel
          key={`${panelKey}-crc`}
          risks={audit.criticalRisks}
          canEdit={canEdit}
          onSave={(risks) => saveCriticalRisks(audit.id, risks)}
        />

        {/* No score beside this heading: the sticky toolbar directly below
            carries the live figure, and the same number drawn twice a
            hand's width apart invites the reader to look for the
            difference. */}
        <div style={{ marginTop: 18 }}>
          <h3 className="panel-title" style={{ margin: 0 }}>
            Health &amp; Safety checklist
          </h3>
          <p className="sub" style={{ margin: "2px 0 0" }}>
            All {QUESTION_COUNT} questions in their 15 areas. An area scores
            from the points recorded against it until every one of its
            questions is answered, and from the answers after that.
          </p>
        </div>

        <EhssAuditForm
          key={`${panelKey}-${unlocked}`}
          initialResponses={audit.responses}
          initialAreas={audit.areaScores ?? {}}
          canEdit={canEdit}
          status={audit.status}
          isAdmin={isAdmin}
          onSave={(
            responses: Record<string, EhssResponse>,
            areas: RecordedAreaScores,
          ) => {
            saveResponses(audit.id, responses);
            saveAreaScores(audit.id, areas);
          }}
          onSubmit={(
            responses: Record<string, EhssResponse>,
            areas: RecordedAreaScores,
          ) => {
            saveResponses(audit.id, responses);
            saveAreaScores(audit.id, areas);
            // The completed checklist becomes the Health & Safety score,
            // scored the same way the page shows it: per area, from
            // whichever of the two sources that area is on record at.
            const total = scoreAreasAndAnswers(CHECKLIST, areas, responses)
              .total;
            if (total !== null) {
              saveDisciplineScores(audit.id, {
                ...audit.disciplineScores,
                hs: total,
              });
            }
            setAuditStatus(audit.id, "submitted");
          }}
          onApprove={() => setAuditStatus(audit.id, "approved")}
          onDelete={() => {
            deleteAudit(audit.id);
            router.push("/audits");
          }}
        />
      </section>
    </div>
  );
}
