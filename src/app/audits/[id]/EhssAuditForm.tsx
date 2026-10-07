"use client";

import { useMemo, useState } from "react";
import { CHECKLIST } from "@/lib/ehss/checklist";
import {
  ANSWER_LABELS,
  ratingFor,
  type EhssAnswer,
  type EhssAuditStatus,
  type EhssResponse,
} from "@/lib/ehss/model";
import {
  GAP_CATEGORIES,
  ISSUE_BY_CODE,
  type IssueCode,
} from "@/lib/ehss/issues";
import { answeredCount, scoreAudit } from "@/lib/ehss/scoring";
import { formatScore } from "@/lib/format";

const ANSWERS: EhssAnswer[] = ["full", "partial", "no", "na"];

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
      // Moving between Partial and No keeps the categories — the cause did
      // not change, only how badly. Anything else clears them, because a
      // category chosen for a gap is meaningless on a Full or N/A.
      const keep =
        (answer === "partial" || answer === "no") &&
        cur !== undefined &&
        (cur.answer === "partial" || cur.answer === "no");
      return {
        ...prev,
        [code]: { answer, issues: keep ? cur!.issues : [] },
      };
    });
  };

  const toggleIssue = (code: string, issue: IssueCode) => {
    setDirty(true);
    setMessage(null);
    setError(null);
    setResponses((prev) => {
      const cur = prev[code]!;
      const has = cur.issues.includes(issue);
      return {
        ...prev,
        [code]: {
          answer: cur.answer,
          // Kept in register order so two auditors who pick the same
          // categories produce the same record.
          issues: GAP_CATEGORIES.map((c) => c.code).filter((c) =>
            has ? cur.issues.includes(c) && c !== issue : cur.issues.includes(c) || c === issue,
          ),
        },
      };
    });
  };

  const setGoodPractice = (code: string, on: boolean) => {
    setDirty(true);
    setMessage(null);
    setError(null);
    setResponses((prev) => ({
      ...prev,
      [code]: { answer: prev[code]!.answer, issues: on ? ["GOOD"] : [] },
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
      if (
        (r.answer === "partial" || r.answer === "no") &&
        r.issues.length === 0
      )
        n++;
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
                        {needsObservation ? (
                          <>
                            <span className="q-detail-label">
                              Why? <em>pick every cause that applies</em>
                              {r.issues.length === 0 && (
                                <strong className="q-required">required</strong>
                              )}
                            </span>
                            <div
                              className="issue-picker"
                              role="group"
                              aria-label={`Issue categories for ${q.code}`}
                            >
                              {GAP_CATEGORIES.map((c) => {
                                const on = r.issues.includes(c.code);
                                return (
                                  <button
                                    key={c.code}
                                    type="button"
                                    aria-pressed={on}
                                    disabled={!canEdit}
                                    title={`${c.description} — ${c.owner}`}
                                    onClick={() => toggleIssue(q.code, c.code)}
                                  >
                                    <b>{c.code}</b> {c.label}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <label className="checkbox-field">
                            <input
                              type="checkbox"
                              checked={r.issues.includes("GOOD")}
                              disabled={!canEdit}
                              onChange={(e) =>
                                setGoodPractice(q.code, e.target.checked)
                              }
                            />
                            {ISSUE_BY_CODE.GOOD.label} — beyond the minimum
                          </label>
                        )}
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
