"use client";

import { useMemo, useState, useTransition } from "react";
import {
  approveAudit,
  deleteAudit,
  saveResponses,
  submitAudit,
  type ResponseInput,
} from "../actions";
import { computeScore } from "@/lib/scoring";
import {
  CORRECTIVE_ACTION_LABELS,
  OBSERVATION_LABELS,
  RESULT_LABELS,
  formatScore,
} from "@/lib/format";
import type {
  AuditQuestionRow,
  AuditResponseRow,
  NcCategoryRow,
} from "@/lib/db";
import type {
  AuditResult,
  AuditStatus,
  CorrectiveActionStatus,
  ObservationType,
} from "@/lib/types";

interface Entry {
  result: AuditResult | null;
  ncCategoryId: string | null;
  observation: ObservationType | null;
  correctiveActionStatus: CorrectiveActionStatus | null;
}

const RESULTS: AuditResult[] = [
  "full_compliance",
  "non_compliance",
  "not_applicable",
];

export function AuditEntryForm({
  auditId,
  auditStatus,
  canEdit,
  isAdmin,
  demoMode = false,
  questions,
  responses,
  ncCategories,
}: {
  auditId: string;
  auditStatus: AuditStatus;
  canEdit: boolean;
  isAdmin: boolean;
  demoMode?: boolean;
  questions: AuditQuestionRow[];
  responses: AuditResponseRow[];
  ncCategories: NcCategoryRow[];
}) {
  const initial = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const q of questions) {
      const r = responses.find((x) => x.question_id === q.id);
      map.set(q.id, {
        result: r?.result ?? null,
        ncCategoryId: r?.nc_category_id ?? null,
        observation: r?.observation ?? null,
        correctiveActionStatus: r?.corrective_action_status ?? null,
      });
    }
    return map;
  }, [questions, responses]);

  const [entries, setEntries] = useState<Map<string, Entry>>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (questionId: string, patch: Partial<Entry>) => {
    setEntries((prev) => {
      const next = new Map(prev);
      const cur = next.get(questionId)!;
      const merged = { ...cur, ...patch };
      if (merged.result !== "non_compliance") {
        merged.ncCategoryId = null;
        merged.correctiveActionStatus = null;
      }
      next.set(questionId, merged);
      return next;
    });
    setMessage(null);
    setError(null);
  };

  const answered = questions.filter((q) => entries.get(q.id)?.result != null);
  const liveScore = computeScore(
    answered.map((q) => ({
      result: entries.get(q.id)!.result!,
      weight: Number(q.weight),
    })),
  );
  const missingNcCategory = answered.some((q) => {
    const e = entries.get(q.id)!;
    return e.result === "non_compliance" && !e.ncCategoryId;
  });

  const collectInputs = (): ResponseInput[] =>
    answered.map((q) => {
      const e = entries.get(q.id)!;
      return {
        questionId: q.id,
        result: e.result!,
        ncCategoryId: e.ncCategoryId,
        observation: e.observation,
        correctiveActionStatus: e.correctiveActionStatus,
      };
    });

  const runAction = (fn: () => Promise<{ error: string | null }>, ok: string) =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const res = await fn();
      if (res.error) setError(res.error);
      else setMessage(ok);
    });

  const onSave = () => {
    if (missingNcCategory) {
      setError("Every Non-Compliance needs a classification before saving.");
      return;
    }
    runAction(() => saveResponses(auditId, collectInputs()), "Saved.");
  };

  const onSubmit = () => {
    if (answered.length < questions.length) {
      setError(
        `Answer all questions before submitting (${answered.length} of ${questions.length} answered).`,
      );
      return;
    }
    if (missingNcCategory) {
      setError("Every Non-Compliance needs a classification before submitting.");
      return;
    }
    runAction(async () => {
      const saved = await saveResponses(auditId, collectInputs());
      if (saved.error) return saved;
      return submitAudit(auditId);
    }, "Audit submitted.");
  };

  const grouped = useMemo(() => {
    const byCategory = new Map<string, AuditQuestionRow[]>();
    for (const q of questions) {
      const list = byCategory.get(q.category) ?? [];
      list.push(q);
      byCategory.set(q.category, list);
    }
    return [...byCategory.entries()];
  }, [questions]);

  return (
    <div>
      {grouped.map(([category, qs]) => (
        <div key={category}>
          <div className="q-category">{category}</div>
          {qs.map((q) => {
            const e = entries.get(q.id)!;
            return (
              <div className="q-item" key={q.id}>
                <div>
                  <span className="code">{q.code}</span>
                  <span className="q-text">{q.question}</span>
                </div>
                <div
                  className="result-toggle"
                  role="group"
                  aria-label={`Result for ${q.code}`}
                >
                  {RESULTS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={e.result === r}
                      disabled={!canEdit}
                      onClick={() => update(q.id, { result: r })}
                    >
                      {RESULT_LABELS[r]}
                    </button>
                  ))}
                </div>

                {e.result === "non_compliance" && (
                  <div className="q-detail">
                    <label className="field">
                      <span>NC classification (required)</span>
                      <select
                        value={e.ncCategoryId ?? ""}
                        disabled={!canEdit}
                        onChange={(ev) =>
                          update(q.id, {
                            ncCategoryId: ev.target.value || null,
                          })
                        }
                      >
                        <option value="">Select a classification…</option>
                        {ncCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Corrective action</span>
                      <select
                        value={e.correctiveActionStatus ?? ""}
                        disabled={!canEdit}
                        onChange={(ev) =>
                          update(q.id, {
                            correctiveActionStatus:
                              (ev.target.value ||
                                null) as CorrectiveActionStatus | null,
                          })
                        }
                      >
                        <option value="">None</option>
                        {(
                          Object.keys(
                            CORRECTIVE_ACTION_LABELS,
                          ) as CorrectiveActionStatus[]
                        ).map((s) => (
                          <option key={s} value={s}>
                            {CORRECTIVE_ACTION_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {e.result != null && (
                  <div className="q-detail">
                    <label className="field">
                      <span>Observation (does not affect score)</span>
                      <select
                        value={e.observation ?? ""}
                        disabled={!canEdit}
                        onChange={(ev) =>
                          update(q.id, {
                            observation: (ev.target.value ||
                              null) as ObservationType | null,
                          })
                        }
                      >
                        <option value="">None</option>
                        {(
                          Object.keys(OBSERVATION_LABELS) as ObservationType[]
                        ).map((o) => (
                          <option key={o} value={o}>
                            {OBSERVATION_LABELS[o]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div className="entry-footer">
        <span className="live-score" aria-live="polite">
          {formatScore(liveScore)}
        </span>
        <span style={{ color: "var(--muted)", fontSize: 12.5 }}>
          {answered.length}/{questions.length} answered
          {liveScore !== null && auditStatus === "draft" ? " · provisional" : ""}
        </span>
        <span className="spacer" />
        {error && <span className="form-error">{error}</span>}
        {message && (
          <span style={{ color: "var(--success-text)", fontSize: 13 }}>
            {message}
          </span>
        )}
        {canEdit && demoMode && (
          <span style={{ color: "var(--muted)", fontSize: 12.5 }}>
            Demo — the live score responds to your changes, but nothing is
            saved.
          </span>
        )}
        {canEdit && !demoMode && (
          <>
            <button
              className="ghost"
              type="button"
              disabled={pending}
              onClick={() =>
                runAction(() => deleteAudit(auditId), "Deleted.")
              }
            >
              Delete draft
            </button>
            <button
              className="ghost"
              type="button"
              disabled={pending}
              onClick={onSave}
            >
              Save
            </button>
            <button
              className="primary"
              type="button"
              disabled={pending}
              onClick={onSubmit}
            >
              Submit audit
            </button>
          </>
        )}
        {isAdmin && !demoMode && auditStatus === "submitted" && (
          <button
            className="primary"
            type="button"
            disabled={pending}
            onClick={() =>
              runAction(() => approveAudit(auditId), "Audit approved.")
            }
          >
            Approve
          </button>
        )}
      </div>
    </div>
  );
}
