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
import { EhssAuditForm } from "./EhssAuditForm";
import {
  CriticalRiskPanel,
  DisciplineScorePanel,
  Scorecard,
  type Source,
} from "./DisciplinePanels";
import { scopeProgress } from "@/lib/ehss/scopes";
import type { Responses } from "@/components/audit/QuestionRow";
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
    saveScopedResponses,
    setAuditStatus,
    deleteAudit,
  } = useEhss();

  /** Which discipline's audit is open. Health & Safety first: it is the one
   * with a checklist, it carries 40% of the scorecard, and it is where an
   * auditor starts. */
  const [tab, setTab] = useState<DisciplineId>("hs");

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

  /**
   * The five figures the scorecard shows, and where each one came from.
   * A recorded number wins — it is a transcription of an audit that
   * happened — and the detailed source stands in when there is none. Saying
   * WHICH is not decoration: "72.3% from a checklist somebody answered" and
   * "72.3% somebody typed" are different claims about the same number.
   */
  const shownScores: DisciplineScores = {
    ...audit.disciplineScores,
    hs: audit.disciplineScores.hs ?? checklistScore ?? undefined,
    crc: audit.disciplineScores.crc ?? crcAuditScore ?? undefined,
  };
  const sources = Object.fromEntries(
    DISCIPLINES.map((d) => {
      if (audit.disciplineScores[d.id] !== undefined) return [d.id, "recorded"];
      if (d.id === "hs") {
        return [d.id, checklistScore === null ? "none" : hsSource];
      }
      if (d.id === "crc") {
        return [d.id, crcAuditScore === null ? "none" : "hazards"];
      }
      const own = scopeProgress(audit, d.id);
      return [d.id, own.complete ? "checklist" : "none"];
    }),
  ) as Record<DisciplineId, Source>;

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

        <Scorecard
          scores={shownScores}
          sources={sources}
          overall={weightedOverall(shownScores)}
          active={tab}
          onSelect={setTab}
        />

        {tab === "crc" && (
          <CriticalRiskPanel
            key={`${panelKey}-crc`}
            audit={audit}
            canEdit={canEdit}
            onSaveRisks={(risks) => saveCriticalRisks(audit.id, risks)}
            onSaveResponses={(scopeId: string, responses: Responses) =>
              saveScopedResponses(audit.id, scopeId, responses)
            }
          />
        )}

        {tab !== "hs" && tab !== "crc" && (
          <DisciplineScorePanel
            key={`${panelKey}-${tab}`}
            discipline={tab}
            audit={audit}
            recorded={audit.disciplineScores[tab]}
            canEdit={canEdit}
            onSaveScore={(value) =>
              saveDisciplineScores(audit.id, {
                ...audit.disciplineScores,
                [tab]: value,
              })
            }
            onSaveResponses={(scopeId: string, responses: Responses) =>
              saveScopedResponses(audit.id, scopeId, responses)
            }
          />
        )}

        {tab === "hs" && (
          <>
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
          </>
        )}

      </section>
    </div>
  );
}
