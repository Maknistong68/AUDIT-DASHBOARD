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

type FormFilter = "all" | "todo" | "gaps" | "needs";

/** Terse by design: four nowrap labels in a segmented control set the
 * form's minimum width, and the long versions pushed a 320px phone
 * sideways. The title carries the full meaning. */
const FILTERS: Array<{ id: FormFilter; label: string; title: string }> = [
  { id: "all", label: "All", title: "Every question" },
  { id: "todo", label: "To do", title: "Not yet answered" },
  { id: "gaps", label: "Gaps", title: "Answered Partial or No" },
  { id: "needs", label: "No cause", title: "A gap with no issue category yet" },
];

/** Does a question survive the current filter? */
function matches(filter: FormFilter, r: EhssResponse | undefined): boolean {
  if (filter === "all") return true;
  if (filter === "todo") return r === undefined;
  if (r === undefined) return false;
  const gap = r.answer === "partial" || r.answer === "no";
  if (filter === "gaps") return gap;
  return gap && r.issues.length === 0;
}

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
  /** What to show. An 81-question form is only workable if you can ask it
   * what is left. */
  const [filter, setFilter] = useState<FormFilter>("all");
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
  /**
   * The checklist's scoreable areas, flattened: section A as one (its
   * questions sit in no sub-section) then B1-B12, C1, C2. Each carries its
   * own progress so the jump strip can show what is left without the
   * auditor scrolling to find out.
   */
  const areas = useMemo(() => {
    const out: Array<{
      key: string;
      section: string;
      label: string;
      codes: string[];
    }> = [];
    for (const section of CHECKLIST) {
      const bare = section.subSections.filter((ss) => ss.code === null);
      if (bare.length > 0) {
        out.push({
          key: section.code,
          section: section.code,
          label: section.code,
          codes: bare.flatMap((ss) => ss.questions.map((q) => q.code)),
        });
      }
      for (const ss of section.subSections) {
        if (ss.code === null) continue;
        out.push({
          key: ss.code,
          section: section.code,
          label: ss.code,
          codes: ss.questions.map((q) => q.code),
        });
      }
    }
    return out;
  }, []);

  const areaProgress = useMemo(() => {
    const map = new Map<string, { answered: number; total: number; needs: number }>();
    for (const area of areas) {
      let answered = 0;
      let needs = 0;
      for (const code of area.codes) {
        const r = responses[code];
        if (!r) continue;
        answered++;
        if ((r.answer === "partial" || r.answer === "no") && r.issues.length === 0)
          needs++;
      }
      map.set(area.key, { answered, total: area.codes.length, needs });
    }
    return map;
  }, [areas, responses]);

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

  const jump = (key: string) => {
    document
      .getElementById(`area-${key}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pct = progress.total === 0 ? 0 : (progress.answered / progress.total) * 100;

  return (
    <div>
      <div className="entry-bar">
        <div className="entry-bar-top">
          <span className="entry-progress" aria-live="polite">
            <strong>
              {progress.answered}/{progress.total}
            </strong>{" "}
            answered
          </span>
          <span className="entry-track" aria-hidden>
            <i style={{ width: `${pct}%` }} />
          </span>
          <span className="entry-live">
            {formatScore(score.total)}
            <em>{ratingFor(score.total) ?? "unrated"}</em>
          </span>
          {missingObservations > 0 && (
            <button
              type="button"
              className="entry-warn"
              onClick={() => setFilter("needs")}
            >
              {missingObservations} need a cause
            </button>
          )}
          <span className="entry-filters" role="group" aria-label="Show">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                title={f.title}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </span>
        </div>
        <div className="entry-jump" role="group" aria-label="Jump to area">
          {areas.map((a) => {
            const prog = areaProgress.get(a.key)!;
            const done = prog.answered === prog.total;
            return (
              <button
                key={a.key}
                type="button"
                className={
                  prog.needs > 0
                    ? "is-needs"
                    : done
                      ? "is-done"
                      : prog.answered > 0
                        ? "is-part"
                        : undefined
                }
                onClick={() => jump(a.key)}
                title={`${a.label} — ${prog.answered} of ${prog.total} answered${prog.needs > 0 ? `, ${prog.needs} need a cause` : ""}`}
              >
                {a.label}
                <i aria-hidden />
              </button>
            );
          })}
        </div>
      </div>

      {CHECKLIST.map((section) => {
        const visibleInSection = section.subSections.some((ss) =>
          ss.questions.some((q) => matches(filter, responses[q.code])),
        );
        if (!visibleInSection) return null;
        return (
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
          {section.subSections.map((ss) => {
            const shown = ss.questions.filter((q) =>
              matches(filter, responses[q.code]),
            );
            if (shown.length === 0) return null;
            return (
            <div
              key={ss.code ?? section.code}
              id={`area-${ss.code ?? section.code}`}
              className="q-area"
            >
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
              {shown.map((q) => {
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
            );
          })}
        </div>
        );
      })}

      {progress.answered === progress.total && filter === "todo" && (
        <div className="entry-empty">
          Every question is answered.{" "}
          <button type="button" onClick={() => setFilter("all")}>
            Show all
          </button>
        </div>
      )}
      {missingObservations === 0 && filter === "needs" && (
        <div className="entry-empty">
          Every gap has a cause recorded.{" "}
          <button type="button" onClick={() => setFilter("all")}>
            Show all
          </button>
        </div>
      )}

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
