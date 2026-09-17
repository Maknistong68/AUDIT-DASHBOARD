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
import { EhssAuditForm } from "./EhssAuditForm";
import type { UserRole } from "@/lib/types";

/** Scores for the four disciplines without their own checklist, plus the
 * Health & Safety score the 81-question checklist produces. */
function DisciplinePanel({
  scores,
  checklistScore,
  canEdit,
  onSave,
}: {
  scores: DisciplineScores;
  checklistScore: number | null;
  canEdit: boolean;
  onSave: (scores: DisciplineScores) => void;
}) {
  const [draft, setDraft] = useState<DisciplineScores>(scores);
  const [saved, setSaved] = useState(false);

  const effective: DisciplineScores = {
    ...draft,
    hs: draft.hs ?? checklistScore ?? undefined,
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
            Health &amp; Safety comes from the checklist below; the other four
            are recorded from their own audits.
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
          canEdit={canEdit}
          onSave={(scores) => saveDisciplineScores(audit.id, scores)}
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
