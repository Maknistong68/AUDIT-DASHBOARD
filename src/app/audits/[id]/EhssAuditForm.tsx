"use client";

import { useMemo, useState } from "react";
import { CHECKLIST } from "@/lib/ehss/checklist";
import {
  ANSWER_LABELS,
  OBSERVATION_BY_CODE,
  OBSERVATION_OPTIONS,
  ratingFor,
  type EhssAnswer,
  type EhssAuditStatus,
  type EhssResponse,
  type ObservationCode,
} from "@/lib/ehss/model";
import { answeredCount, scoreAudit } from "@/lib/ehss/scoring";
import { formatScore } from "@/lib/format";

const ANSWERS: EhssAnswer[] = ["full", "partial", "no", "na"];
const GAP_OPTIONS = OBSERVATION_OPTIONS.filter((o) => o.gap);

const confirmDiscard = () =>
  window.confirm("Discard this draft review? This cannot be undone.");

export function EhssAuditForm({
  initialResponses,
  canEdit,
  status,
  isAdmin = false,
  onSave,
  onSubmit,
  onApprove,
  onDelete,
}: {
  initialResponses: Record<string, EhssResponse>;
  canEdit: boolean;
  status: EhssAuditStatus;
  isAdmin?: boolean;
  onSave?: (responses: Record<string, EhssResponse>) => void;
  onSubmit?: (responses: Record<string, EhssResponse>) => void;
  onApprove?: () => void;
  onDelete?: () => void;
}) {
  const [responses, setResponses] =
    useState<Record<string, EhssResponse>>(initialResponses);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setAnswer = (code: string, answer: EhssAnswer) => {
    setDirty(true);
    setMessage(null);
    setError(null);
    setResponses((prev) => {
      const cur = prev[code];
      const keepGapObs =
        (answer === "partial" || answer === "no") &&
        cur?.observation &&
        OBSERVATION_BY_CODE[cur.observation].gap;
      return {
        ...prev,
        [code]: {
          answer,
          observation:
            answer === "na" ? null : keepGapObs ? cur!.observation : null,
        },
      };
    });
  };

  const setObservation = (code: string, observation: ObservationCode | null) => {
    setDirty(true);
    setMessage(null);
    setError(null);
    setResponses((prev) => ({
      ...prev,
      [code]: { answer: prev[code]!.answer, observation },
    }));
  };

  const score = useMemo(() => scoreAudit(CHECKLIST, responses), [responses]);
  const progress = useMemo(
    () => answeredCount(CHECKLIST, responses),
    [responses],
  );
  const missingObservations = useMemo(() => {
    let n = 0;
    for (const r of Object.values(responses)) {
      if ((r.answer === "partial" || r.answer === "no") && !r.observation) n++;
    }
    return n;
  }, [responses]);

  return (
    <div>
      {CHECKLIST.map((section) => (
        <div key={section.code}>
          <div className="section-head">
            <span>
              {section.code}. {section.title}
            </span>
            <span className="section-score">
              {formatScore(
                score.sections.find((s) => s.code === section.code)?.score ??
                  null,
              )}
            </span>
          </div>
          {section.subSections.map((ss) => (
            <div key={ss.code ?? section.code}>
              {ss.code && (
                <div className="q-category">
                  {ss.code} — {ss.title}
                  <span className="section-score">
                    {formatScore(
                      score.sections
                        .find((s) => s.code === section.code)
                        ?.subSections.find((x) => x.code === ss.code)?.score ??
                        null,
                    )}
                  </span>
                </div>
              )}
              {ss.questions.map((q) => {
                const r = responses[q.code];
                const needsObservation =
                  r && (r.answer === "partial" || r.answer === "no");
                return (
                  <div className="q-item" key={q.code}>
                    <div>
                      <span className="code">{q.code}</span>
                      <span className="q-text">{q.text}</span>{" "}
                      <span className="q-weight">w{q.weight}</span>
                    </div>
                    <div
                      className="result-toggle"
                      role="group"
                      aria-label={`Answer for ${q.code}`}
                    >
                      {ANSWERS.map((a) => (
                        <button
                          key={a}
                          type="button"
                          aria-pressed={r?.answer === a}
                          disabled={!canEdit}
                          onClick={() => setAnswer(q.code, a)}
                        >
                          {ANSWER_LABELS[a]}
                        </button>
                      ))}
                    </div>

                    {r && r.answer !== "na" && (
                      <div className="q-detail">
                        <label className="field">
                          <span>
                            {needsObservation
                              ? "Observation (required)"
                              : "Observation (optional)"}
                          </span>
                          <select
                            value={r.observation ?? ""}
                            disabled={!canEdit}
                            onChange={(e) =>
                              setObservation(
                                q.code,
                                (e.target.value || null) as ObservationCode | null,
                              )
                            }
                          >
                            <option value="">
                              {needsObservation
                                ? "Select a classification…"
                                : "None"}
                            </option>
                            {(needsObservation
                              ? GAP_OPTIONS
                              : OBSERVATION_OPTIONS.filter((o) => !o.gap)
                            ).map((o) => (
                              <option key={o.code} value={o.code}>
                                {o.code} — {o.label}
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
        </div>
      ))}

      <div className="entry-footer">
        <span className="live-score" aria-live="polite">
          {formatScore(score.total)}
        </span>
        <span style={{ color: "var(--muted)", fontSize: 12.5 }}>
          {ratingFor(score.total) ?? "unrated"} · {progress.answered}/
          {progress.total} answered
          {status === "draft" && score.total !== null ? " · provisional" : ""}
        </span>
        {missingObservations > 0 && (
          <span className="form-error">
            {missingObservations} gap
            {missingObservations === 1 ? "" : "s"} still need a classification
          </span>
        )}
        {error && <span className="form-error">{error}</span>}
        {message && (
          <span style={{ color: "var(--success-text)", fontSize: 13 }}>
            {message}
          </span>
        )}
        <span className="spacer" />
        {canEdit && (
          <>
            {onDelete && (
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  if (progress.answered > 0 && !confirmDiscard()) return;
                  onDelete();
                }}
              >
                Discard
              </button>
            )}
            <button
              className="ghost"
              type="button"
              disabled={!dirty}
              onClick={() => {
                onSave?.(responses);
                setDirty(false);
                setMessage("Saved.");
              }}
            >
              {dirty ? "Save" : "Saved"}
            </button>
            <button
              className="primary"
              type="button"
              onClick={() => {
                if (progress.answered < progress.total) {
                  setError(
                    `Answer all ${progress.total} questions before submitting (${progress.answered} done).`,
                  );
                  return;
                }
                if (missingObservations > 0) {
                  setError(
                    "Every Partial or No answer needs an observation classification.",
                  );
                  return;
                }
                onSubmit?.(responses);
                setDirty(false);
                setMessage("Review submitted.");
              }}
            >
              Submit review
            </button>
          </>
        )}
        {isAdmin && status === "submitted" && onApprove && (
          <button className="primary" type="button" onClick={onApprove}>
            Approve
          </button>
        )}
      </div>
    </div>
  );
}
