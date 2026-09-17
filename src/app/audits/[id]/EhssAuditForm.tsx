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

export function EhssAuditForm({
  initialResponses,
  canEdit,
  status,
}: {
  initialResponses: Record<string, EhssResponse>;
  canEdit: boolean;
  status: EhssAuditStatus;
}) {
  const [responses, setResponses] =
    useState<Record<string, EhssResponse>>(initialResponses);

  const setAnswer = (code: string, answer: EhssAnswer) => {
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
        <span className="spacer" />
        {canEdit && (
          <span style={{ color: "var(--muted)", fontSize: 12.5 }}>
            Demo — scores update live; nothing is saved.
          </span>
        )}
      </div>
    </div>
  );
}
