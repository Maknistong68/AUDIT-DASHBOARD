"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CHECKLIST } from "@/lib/ehss/checklist";
import {
  ANSWER_LABELS,
  ratingFor,
  type EhssAnswer,
  type EhssAuditStatus,
  type EhssResponse,
  type RecordedAreaScores,
} from "@/lib/ehss/model";
import {
  GAP_CATEGORIES,
  ISSUE_BY_CODE,
  type IssueCode,
} from "@/lib/ehss/issues";
import { areaSource, scoreAreasAndAnswers } from "@/lib/ehss/scoring";
import { formatScore } from "@/lib/format";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { quarterLabel } from "@/lib/ehss/model";
import type { PriorReview } from "@/lib/ehss/summaries";

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

/** A number field that accepts an empty box: the area points are optional
 * per area, and "" has to survive typing rather than snapping to 0. */
const parsePoints = (raw: string): number | null => {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) || n < 0 ? null : n;
};

/**
 * One checklist area's editable points.
 *
 * The 19 imported reviews hold exactly this and no answers: points scored
 * against the points that applied, per area. `possible` is per audit and
 * not the checklist's nominal weight, because the workbook drops an N/A
 * question's weight out of it — so it is entered, not derived.
 */
function AreaPoints({
  area,
  points,
  nominal,
  canEdit,
  onChange,
}: {
  area: string;
  points: { scored: number; possible: number } | undefined;
  /** The area's weight with every question applicable — the ceiling the
   * sheet's own entry would use before N/A questions come out of it. */
  nominal: number;
  canEdit: boolean;
  onChange: (next: { scored: number; possible: number } | undefined) => void;
}) {
  const set = (field: "scored" | "possible", raw: string) => {
    const value = parsePoints(raw);
    const base = points ?? { scored: 0, possible: 0 };
    const next = { ...base, [field]: value ?? 0 };
    // Clearing the applicable points is how an area stops being on record;
    // a 0/0 area is not "scored zero", it is not scored.
    onChange(next.possible <= 0 && next.scored <= 0 ? undefined : next);
  };

  const over = points !== undefined && points.scored > points.possible;

  return (
    <div className="area-points">
      <label className="field">
        <span>Points scored</span>
        <input
          type="number"
          min={0}
          step={0.5}
          disabled={!canEdit}
          placeholder="—"
          value={points?.scored ?? ""}
          onChange={(e) => set("scored", e.target.value)}
        />
      </label>
      <label className="field">
        <span>
          Points that applied{" "}
          <em title="The area's full weight when every question applies. N/A questions come out of it.">
            of {nominal}
          </em>
        </span>
        <input
          type="number"
          min={0}
          step={0.5}
          disabled={!canEdit}
          placeholder="—"
          value={points?.possible ?? ""}
          onChange={(e) => set("possible", e.target.value)}
        />
      </label>
      {over && (
        <span className="form-error">
          {area} scores more points than applied.
        </span>
      )}
    </div>
  );
}

export function EhssAuditForm({
  initialResponses,
  initialAreas,
  sharedStorage,
  prior,
  canEdit,
  status,
  isAdmin = false,
  onSave,
  onSubmit,
  onApprove,
  onDelete,
}: {
  initialResponses: Record<string, EhssResponse>;
  /** Area points from an imported review; `{}` for one entered here. */
  initialAreas: RecordedAreaScores;
  /** True when a save is visible to other people. Read from the storage
   * seam rather than assumed, so the warning below disappears by itself
   * the day a shared adapter is wired in. */
  sharedStorage: boolean;
  /**
   * The same contractor's previous finalized review, per area.
   *
   * An auditor used to fill this form with no sight of last quarter — the
   * data existed, on another page. A gap that was below target last time
   * and is below target again is the single most useful thing to know while
   * standing on the site, and it was the one thing the screen would not say.
   */
  prior: PriorReview | null;
  canEdit: boolean;
  status: EhssAuditStatus;
  isAdmin?: boolean;
  onSave?: (
    responses: Record<string, EhssResponse>,
    areas: RecordedAreaScores,
  ) => void;
  onSubmit?: (
    responses: Record<string, EhssResponse>,
    areas: RecordedAreaScores,
  ) => void;
  onApprove?: () => void;
  onDelete?: () => void;
}) {
  const [responses, setResponses] =
    useState<Record<string, EhssResponse>>(initialResponses);
  const [areas, setAreas] = useState<RecordedAreaScores>(initialAreas);
  const [dirty, setDirty] = useState(false);
  /** What to show. An 81-question form is only workable if you can ask it
   * what is left. */
  const [filter, setFilter] = useState<FormFilter>("all");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * The sticky toolbar's measured height, published as a CSS variable so a
   * jump lands below it rather than behind it.
   *
   * It used to be a fixed 170px in the stylesheet, which was right for the
   * two rows the bar had then. The bar now has three, the third expands
   * when the scoring help is opened, and a hard-coded offset cannot be
   * right for a box whose height changes. Measuring it is the only version
   * of this that stays correct when a row is added — and a row was added.
   */
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(170);
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = (height: number) => {
      // The bar's HEIGHT is not the offset a jump needs to clear: it sticks
      // BELOW the floating top bar, so what a target must clear is where
      // its bottom edge comes to rest — its sticky `top` plus its height.
      // Reading `top` from the computed style rather than repeating 74px
      // here keeps the two from drifting when the top bar changes.
      const stickyTop = parseFloat(getComputedStyle(el).top);
      setBarHeight(
        Math.ceil(height + (Number.isFinite(stickyTop) ? stickyTop : 0)),
      );
    };
    const observer = new ResizeObserver(([entry]) => {
      // BORDER box, not content box: the bar carries 11px of padding and a
      // 1px border, and a content-box measurement lands the target 24px
      // behind the thing it was supposed to clear.
      const h =
        entry?.borderBoxSize?.[0]?.blockSize ??
        el.getBoundingClientRect().height;
      if (h > 0) measure(h);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const touch = () => {
    setDirty(true);
    setMessage(null);
    setError(null);
  };

  const setAnswer = (code: string, answer: EhssAnswer) => {
    touch();
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

  /** Taking an answer back off a question — the only way to undo a misclick
   * on an imported review, where every answer costs the area its recorded
   * figure once the set is complete. */
  const clearAnswer = (code: string) => {
    touch();
    setResponses((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  const toggleIssue = (code: string, issue: IssueCode) => {
    touch();
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
    touch();
    setResponses((prev) => ({
      ...prev,
      [code]: { answer: prev[code]!.answer, issues: on ? ["GOOD"] : [] },
    }));
  };

  const setAreaPoints = (
    key: string,
    next: { scored: number; possible: number } | undefined,
  ) => {
    touch();
    setAreas((prev) => {
      const out = { ...prev };
      if (next === undefined) delete out[key];
      else out[key] = next;
      return out;
    });
  };

  const score = useMemo(
    () => scoreAreasAndAnswers(CHECKLIST, areas, responses),
    [areas, responses],
  );

  /**
   * The checklist's scoreable areas, flattened: section A as one (its
   * questions sit in no sub-section) then B1-B12, C1, C2 — the same 15 the
   * imported sheets are keyed by. Each carries the questions it asks and
   * the weight they add up to, so the area's points row and its questions
   * sit together rather than in two tables that have to be read against
   * each other.
   */
  const areaList = useMemo(() => {
    const out: Array<{
      key: string;
      section: string;
      title: string;
      questions: (typeof CHECKLIST)[number]["subSections"][number]["questions"];
      nominal: number;
    }> = [];
    for (const section of CHECKLIST) {
      const bare = section.subSections.filter((ss) => ss.code === null);
      if (bare.length > 0) {
        const questions = bare.flatMap((ss) => ss.questions);
        out.push({
          key: section.code,
          section: section.code,
          title: section.title,
          questions,
          nominal: questions.reduce((n, q) => n + q.weight, 0),
        });
      }
      for (const ss of section.subSections) {
        if (ss.code === null) continue;
        out.push({
          key: ss.code,
          section: section.code,
          title: ss.title ?? ss.code,
          questions: ss.questions,
          nominal: ss.questions.reduce((n, q) => n + q.weight, 0),
        });
      }
    }
    return out;
  }, []);

  /**
   * Per area: how far through its questions, how many gaps still need a
   * cause, and — the part that matters on a review imported from a sheet —
   * WHICH of the two sources is scoring it right now.
   */
  const areaState = useMemo(() => {
    const map = new Map<
      string,
      {
        answered: number;
        total: number;
        needs: number;
        source: "answers" | "points" | "none";
        score: number | null;
        hasPoints: boolean;
      }
    >();
    for (const area of areaList) {
      let answered = 0;
      let needs = 0;
      for (const q of area.questions) {
        const r = responses[q.code];
        if (!r) continue;
        answered++;
        if ((r.answer === "partial" || r.answer === "no") && r.issues.length === 0)
          needs++;
      }
      const { source, score: areaScore } = areaSource(
        area.questions,
        areas,
        area.key,
        responses,
      );
      map.set(area.key, {
        answered,
        total: area.questions.length,
        needs,
        source,
        score: areaScore,
        hasPoints: areas[area.key] !== undefined,
      });
    }
    return map;
  }, [areaList, areas, responses]);

  const answeredTotal = useMemo(() => {
    let answered = 0;
    let total = 0;
    for (const area of areaList) {
      total += area.questions.length;
      for (const q of area.questions) if (responses[q.code]) answered++;
    }
    return { answered, total };
  }, [areaList, responses]);

  /**
   * What blocks submission. An area already on record as points is complete
   * at the grain it was audited — demanding its eight answers would make
   * every imported review unsubmittable. An area with no points has nothing
   * behind it until its questions are answered.
   */
  const outstanding = useMemo(() => {
    let n = 0;
    for (const area of areaList) {
      const st = areaState.get(area.key)!;
      if (st.hasPoints) continue;
      n += area.questions.length - st.answered;
    }
    return n;
  }, [areaList, areaState]);

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

  const unscoredAreas = useMemo(
    () => areaList.filter((a) => areaState.get(a.key)!.score === null).length,
    [areaList, areaState],
  );

  const jump = (key: string) => {
    document
      .getElementById(`area-${key}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pct =
    answeredTotal.total === 0
      ? 0
      : (answeredTotal.answered / answeredTotal.total) * 100;

  const save = () => {
    onSave?.(responses, areas);
    setDirty(false);
    setMessage("Saved.");
  };

  return (
    <div style={{ "--entry-bar-h": `${barHeight}px` } as React.CSSProperties}>
      <div className="entry-bar" ref={barRef}>
        <div className="entry-bar-top">
          <span className="entry-progress" aria-live="polite">
            <strong>
              {answeredTotal.answered}/{answeredTotal.total}
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
          {prior && (
            <span className="entry-prior">
              {quarterLabel(prior.quarter)} <b>{formatScore(prior.total)}</b>
            </span>
          )}
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
        {/* The rules, where the scoring happens. They lived only on the
            admin reference page, which an auditor on site cannot reach and
            would not think to. Closed by default: this is the auditor's
            screen and it is long enough. */}
        <details className="entry-help">
          <summary>How this is scored</summary>
          <div>
            <p>
              Points = weight × <b>Full 1</b>, <b>Partial ½</b>, <b>No 0</b>.
              A question marked <b>N/A</b> comes out of the top and the
              bottom — it is not a zero, it is not asked.
            </p>
            <p>
              An <b>area</b> scores its points over the weight that applied.
              A <b>section</b> is the mean of its areas, so a small area
              counts as much as a large one. The <b>total</b> is the mean of
              the three sections.
            </p>
            <p>
              Every Partial or No needs at least one cause, and more than one
              may apply — a finding usually has several and picking one loses
              the rest. There is <b>no notes field and no photo upload</b>,
              deliberately: this system holds contractor results and names
              nobody, which is what lets it run where it runs.
            </p>
          </div>
        </details>
        <div className="entry-jump" role="group" aria-label="Jump to area">
          {areaList.map((a) => {
            const st = areaState.get(a.key)!;
            const cls =
              st.needs > 0
                ? "is-needs"
                : st.source === "answers"
                  ? "is-done"
                  : st.source === "points"
                    ? "is-points"
                    : st.answered > 0
                      ? "is-part"
                      : undefined;
            const how =
              st.source === "points"
                ? "scored from recorded points"
                : st.source === "answers"
                  ? "scored from the checklist"
                  : "not scored yet";
            return (
              <button
                key={a.key}
                type="button"
                className={cls}
                onClick={() => jump(a.key)}
                title={`${a.key} — ${how}; ${st.answered} of ${st.total} answered${st.needs > 0 ? `, ${st.needs} need a cause` : ""}`}
              >
                {a.key}
                <i aria-hidden />
              </button>
            );
          })}
        </div>
      </div>

      {CHECKLIST.map((section) => {
        const sectionAreas = areaList.filter((a) => a.section === section.code);
        const visible = sectionAreas.filter(
          (a) =>
            filter === "all" ||
            a.questions.some((q) => matches(filter, responses[q.code])),
        );
        if (visible.length === 0) return null;
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
            {visible.map((area) => {
              const st = areaState.get(area.key)!;
              const priorArea = prior?.areas[area.key];
              // "Again" is the owner's definition of recurring applied to an
              // area: below target last review AND below target now.
              const repeat =
                priorArea !== undefined &&
                priorArea !== null &&
                priorArea < TARGET_SCORE &&
                st.score !== null &&
                st.score < TARGET_SCORE;
              const shown = area.questions.filter((q) =>
                matches(filter, responses[q.code]),
              );
              return (
                <div key={area.key} id={`area-${area.key}`} className="q-area">
                  <div className="q-category">
                    <span>
                      {area.key} — {area.title}
                    </span>
                    <span
                      className={`area-source is-${st.source}`}
                      title={
                        st.source === "points"
                          ? `Scored from the points recorded for ${area.key}. Answer all ${st.total} questions and the checklist takes over.`
                          : st.source === "answers"
                            ? `Scored from the ${st.total} checklist answers.`
                            : "No points and no answers on record for this area, so it is left out of the section average."
                      }
                    >
                      {st.source === "points"
                        ? "from points"
                        : st.source === "answers"
                          ? "from answers"
                          : "not scored"}
                    </span>
                    {priorArea !== undefined && (
                      <span
                        className={`area-prior${repeat ? " is-repeat" : ""}`}
                        title={
                          repeat
                            ? `Below ${TARGET_SCORE}% in ${quarterLabel(prior!.quarter)} and again now — this is the second review running`
                            : `${quarterLabel(prior!.quarter)}: ${formatScore(priorArea)}`
                        }
                      >
                        {repeat && <b>again</b>}
                        last {formatScore(priorArea)}
                      </span>
                    )}
                    <span className="section-score">
                      {formatScore(st.score)}
                    </span>
                  </div>

                  <AreaPoints
                    area={area.key}
                    points={areas[area.key]}
                    nominal={area.nominal}
                    canEdit={canEdit}
                    onChange={(next) => setAreaPoints(area.key, next)}
                  />

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
                          {canEdit && r && (
                            <button
                              type="button"
                              className="q-clear"
                              title={`Clear the answer to ${q.code}`}
                              onClick={() => clearAnswer(q.code)}
                            >
                              Clear
                            </button>
                          )}
                        </div>

                        {r && r.answer !== "na" && (
                          <div className="q-detail">
                            {needsObservation ? (
                              <>
                                <span className="q-detail-label">
                                  Why? <em>pick every cause that applies</em>
                                  {r.issues.length === 0 && (
                                    <strong className="q-required">
                                      required
                                    </strong>
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
                                        onClick={() =>
                                          toggleIssue(q.code, c.code)
                                        }
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

      {answeredTotal.answered === answeredTotal.total && filter === "todo" && (
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
          {ratingFor(score.total) ?? "unrated"} · {answeredTotal.answered}/
          {answeredTotal.total} answered
          {status === "draft" && score.total !== null ? " · provisional" : ""}
          {/* Say what Save actually does. While storage is local it implies
              a durability it does not have: edits live in THIS browser and
              nobody else can see them. */}
          {!sharedStorage && " · saved in this browser only"}
        </span>
        {missingObservations > 0 && (
          <span className="form-error">
            {missingObservations} gap
            {missingObservations === 1 ? " still needs" : "s still need"} a
            classification
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
                  if (answeredTotal.answered > 0 && !confirmDiscard()) return;
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
              onClick={save}
              title={
                sharedStorage
                  ? "Saved for everyone"
                  : "Held in this browser until the app is connected to a database"
              }
            >
              {dirty ? "Save" : "Saved"}
            </button>
            {status !== "approved" && (
              <button
                className="primary"
                type="button"
                onClick={() => {
                  if (unscoredAreas > 0) {
                    setError(
                      `${unscoredAreas} checklist area${unscoredAreas === 1 ? " has" : "s have"} neither points nor answers.`,
                    );
                    return;
                  }
                  if (outstanding > 0) {
                    setError(
                      `${outstanding} question${outstanding === 1 ? "" : "s"} in areas with no recorded points still need an answer.`,
                    );
                    return;
                  }
                  if (missingObservations > 0) {
                    setError(
                      "Every Partial or No answer needs an observation classification.",
                    );
                    return;
                  }
                  onSubmit?.(responses, areas);
                  setDirty(false);
                  setMessage("Review submitted.");
                }}
              >
                {status === "draft" ? "Submit review" : "Re-submit review"}
              </button>
            )}
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
