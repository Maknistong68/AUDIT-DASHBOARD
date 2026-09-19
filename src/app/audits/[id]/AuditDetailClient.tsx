"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEhss } from "@/lib/ehss/store";
import { contractorLabel } from "@/lib/ehss/mock";
import { AuditStatusBadge, RatingBadge } from "@/components/Badges";
import { formatDate, formatScore } from "@/lib/format";
import { CHECKLIST } from "@/lib/ehss/checklist";
import { scoreAudit } from "@/lib/ehss/scoring";
import {
  quarterLabel,
  ratingFor,
  type EhssResponse,
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

/** Scores for the four disciplines without their own checklist, plus the
 * Health & Safety score the 81-question checklist produces. */
function DisciplinePanel({
  scores,
  checklistScore,
  crcAuditScore,
  canEdit,
  onSave,
}: {
  scores: DisciplineScores;
  checklistScore: number | null;
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
            Health &amp; Safety comes from the checklist below and Critical
            Risk Control from the hazard scores; the other three are recorded
            from their own audits.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="brief-score" style={{ fontSize: 28 }}>
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
                    : `${effective.hs.toFixed(1)}% (checklist)`
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
          <div className="brief-score" style={{ fontSize: 28 }}>
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
    saveDisciplineScores,
    saveCriticalRisks,
    setAuditStatus,
    deleteAudit,
  } = useEhss();

  const audit = audits.find((a) => a.id === auditId);
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
  const canEdit = audit.status === "draft" && (isAdmin || role === "auditor");
  const checklistScore = scoreAudit(CHECKLIST, audit.responses).total;
  const crcAuditScore = crcScore(audit.criticalRisks);

  return (
    <div className="stack">
      <section className="card">
        <h2>
          {contractor ? contractorLabel(contractor) : "Contractor"} — EHSS
          Quarterly Review
        </h2>
        <p className="sub">
          {subRegion?.name} · {quarterLabel(audit.quarter)} ·{" "}
          {formatDate(audit.auditDate)} · {audit.inspectionNo} ·{" "}
          <AuditStatusBadge status={audit.status} />
          {contractor && !contractor.active && " · contractor inactive"}
        </p>

        <DisciplinePanel
          key={`${audit.id}-disciplines`}
          scores={audit.disciplineScores}
          checklistScore={checklistScore}
          crcAuditScore={crcAuditScore}
          canEdit={canEdit}
          onSave={(scores) => saveDisciplineScores(audit.id, scores)}
        />

        <CriticalRiskPanel
          key={`${audit.id}-crc`}
          risks={audit.criticalRisks}
          canEdit={canEdit}
          onSave={(risks) => saveCriticalRisks(audit.id, risks)}
        />

        <EhssAuditForm
          key={audit.id}
          initialResponses={audit.responses}
          canEdit={canEdit}
          status={audit.status}
          isAdmin={isAdmin}
          onSave={(responses: Record<string, EhssResponse>) =>
            saveResponses(audit.id, responses)
          }
          onSubmit={(responses: Record<string, EhssResponse>) => {
            saveResponses(audit.id, responses);
            // A completed checklist becomes the Health & Safety score.
            const total = scoreAudit(CHECKLIST, responses).total;
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
