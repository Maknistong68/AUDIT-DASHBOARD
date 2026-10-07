"use client";

import { useMemo, useState } from "react";
import { useEhss } from "@/lib/ehss/store";
import { AnalysisTabs } from "@/components/AnalysisTabs";
import { RecordedOnlyNote } from "@/components/RecordedOnlyNote";
import { FloatingPanel } from "@/components/FloatingPanel";
import { bandColor } from "@/lib/ehss/bands";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { DOMAIN_BY_ID } from "@/lib/ehss/domains";
import { quarterLabel } from "@/lib/ehss/model";
import { ISSUE_BY_CODE } from "@/lib/ehss/issues";
import { formatScore } from "@/lib/format";
import {
  TIMEFRAMES,
  checklistMatrix,
  checklistQuestionStats,
  contractorStats,
  questionByContractor,
  summarizeAll,
  type ChecklistAreaStat,
  type ChecklistQuestionStat,
  type TimeframeId,
} from "@/lib/ehss/summaries";

/** Tint rather than a solid fill: band colours run from pale yellow to deep
 * red, so a solid cell would need its ink flipped per band. A tint keeps the
 * number in body ink at full contrast and still reads as a heat grid. */
const tint = (score: number | null) =>
  score === null
    ? "transparent"
    : `color-mix(in srgb, ${bandColor(score)} 26%, transparent)`;

/** A share of contractors, as a small proportional bar plus the fraction. */
function Share({ n, of }: { n: number; of: number }) {
  return (
    <span className="share">
      <span className="share-bar" aria-hidden>
        <i
          style={{
            width: `${of === 0 ? 0 : (n / of) * 100}%`,
            background:
              of > 0 && n / of >= 0.6
                ? "var(--status-critical)"
                : of > 0 && n / of >= 0.3
                  ? "var(--status-serious)"
                  : "var(--status-warning)",
          }}
        />
      </span>
      <span className="share-n">
        {n}/{of}
      </span>
    </span>
  );
}

/**
 * H&S checklist analysis: the 81 questions read ACROSS contractors.
 *
 * The question this page answers is not "how is this contractor doing" —
 * the dashboard does that — but "is this our problem or theirs". A control
 * nine of eleven contractors fail is a programme failure that one briefing
 * fixes everywhere; a control one contractor fails belongs to that
 * contractor. The matrix shows which is which at a glance.
 */
export function ChecklistClient() {
  const { subRegions, contractors, audits } = useEhss();

  const [subRegionId, setSubRegionId] = useState("all");
  const [timeframe, setTimeframe] = useState<TimeframeId>("last4");
  const [area, setArea] = useState<ChecklistAreaStat | null>(null);
  const [question, setQuestion] = useState<ChecklistQuestionStat | null>(null);

  const inScope = useMemo(
    () =>
      contractors.filter(
        (c) =>
          (subRegionId === "all" || c.subRegionId === subRegionId) && c.active,
      ),
    [contractors, subRegionId],
  );
  const scopeIds = useMemo(() => new Set(inScope.map((c) => c.id)), [inScope]);

  const scopedAudits = useMemo(
    () => audits.filter((a) => scopeIds.has(a.contractorId)),
    [audits, scopeIds],
  );
  const summaries = useMemo(
    () => summarizeAll(scopedAudits, contractors, subRegions),
    [scopedAudits, contractors, subRegions],
  );

  /** Narrow to the selected timeframe, the same way the dashboard does. */
  const windowIds = useMemo(
    () =>
      new Set(
        contractorStats(summaries, timeframe).flatMap((s) =>
          s.audits.map((a) => a.id),
        ),
      ),
    [summaries, timeframe],
  );
  const windowSummaries = useMemo(
    () => summaries.filter((s) => windowIds.has(s.id)),
    [summaries, windowIds],
  );
  const windowAudits = useMemo(
    () => scopedAudits.filter((a) => windowIds.has(a.id)),
    [scopedAudits, windowIds],
  );

  /** The matrix works from the imported area scores; the question ranking
   * below needs answers, which an imported review does not carry. */
  const areaScoresOnly =
    windowSummaries.length > 0 &&
    windowSummaries.every((s) => s.fromAreaScores);

  const { areas, contractors: roster } = useMemo(
    () => checklistMatrix(windowSummaries),
    [windowSummaries],
  );
  const ranked = useMemo(
    () => [...areas].sort((a, b) => (a.avg ?? 101) - (b.avg ?? 101)),
    [areas],
  );

  const systemic = useMemo(
    () => checklistQuestionStats(windowSummaries, windowAudits).slice(0, 10),
    [windowSummaries, windowAudits],
  );

  const areaQuestions = useMemo(
    () =>
      area
        ? checklistQuestionStats(windowSummaries, windowAudits, area.code)
        : [],
    [area, windowSummaries, windowAudits],
  );

  const answers = useMemo(
    () =>
      question
        ? questionByContractor(question.code, windowSummaries, windowAudits)
        : [],
    [question, windowSummaries, windowAudits],
  );

  const close = () => {
    setArea(null);
    setQuestion(null);
  };

  return (
    <div className="stack">
      <AnalysisTabs />
      <div className="filter-row">
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Sub-region</span>
          <select
            value={subRegionId}
            onChange={(e) => {
              setSubRegionId(e.target.value);
              close();
            }}
          >
            <option value="all">All sub-regions</option>
            {subRegions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Timeframe</span>
          <select
            value={timeframe}
            onChange={(e) => {
              setTimeframe(e.target.value as TimeframeId);
              close();
            }}
          >
            {TIMEFRAMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="card">
        <h2>Checklist area against contractor</h2>
        <p className="sub">
          Every area of the 81-question H&amp;S checklist, weakest first, and
          how each contractor scores on it. A row that is red across the board
          is a programme problem; one red cell is that contractor&apos;s.
          Select an area for the questions inside it.
        </p>
        {roster.length === 0 ? (
          <div className="chart-empty">No finalized reviews in scope.</div>
        ) : (
          <div className="table-scroll">
            <table className="data matrix">
              <thead>
                <tr>
                  <th className="matrix-area">Area</th>
                  <th className="num">Avg</th>
                  <th>Below target</th>
                  {roster.map((c) => (
                    <th
                      key={c.contractorId}
                      className="matrix-co"
                      title={c.label}
                    >
                      <span className="matrix-co-name">{c.name}</span>
                      <span className="matrix-co-code">{c.code}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranked.map((a) => (
                  <tr key={a.code}>
                    <th scope="row" className="matrix-area">
                      <button type="button" onClick={() => setArea(a)}>
                        <strong>{a.code}</strong> {a.title}
                        <em>{a.questionCount}q</em>
                      </button>
                    </th>
                    <td
                      className="num"
                      style={{ color: bandColor(a.avg), fontWeight: 650 }}
                    >
                      {formatScore(a.avg)}
                    </td>
                    <td>
                      <Share n={a.belowTarget} of={a.contractors} />
                    </td>
                    {a.cells.map((c) => (
                      <td
                        key={c.contractorId}
                        className="matrix-cell"
                        style={{ background: tint(c.score) }}
                        title={`${c.label} · ${a.code} ${a.title}: ${formatScore(c.score)}`}
                      >
                        {c.score === null ? "—" : c.score.toFixed(0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Failed by the most contractors</h2>
        <p className="sub">
          Counted by contractor, not by answer — one contractor failing the
          same question four quarters running is one contractor with a
          problem. The questions at the top are the ones worth fixing
          centrally rather than contractor by contractor.
        </p>
        {areaScoresOnly ? (
          <RecordedOnlyNote what="This ranking needs answers question by question, so it fills in from the first review entered through the app." />
        ) : systemic.length === 0 ? (
          <div className="chart-empty">No finalized reviews in scope.</div>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Area</th>
                  <th>Pillar</th>
                  <th>Contractors failing</th>
                  <th className="num">Points lost</th>
                </tr>
              </thead>
              <tbody>
                {systemic.map((q) => (
                  <tr key={q.code}>
                    <td>
                      <button
                        type="button"
                        className="q-link"
                        onClick={() => setQuestion(q)}
                      >
                        <strong>{q.code}</strong>{" "}
                        <span className="q-weight">w{q.weight}</span>
                        <div className="issue-text">{q.text}</div>
                      </button>
                    </td>
                    <td>{q.areaTitle}</td>
                    <td>{DOMAIN_BY_ID[q.domain].label}</td>
                    <td style={{ width: 150 }}>
                      <Share n={q.failing} of={q.contractors} />
                    </td>
                    <td className="num">{q.lostPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(area || question) && (
        <FloatingPanel
          title={
            question
              ? `${question.code} — ${question.areaTitle}`
              : `${area!.code} ${area!.title}`
          }
          subtitle={
            question
              ? `Failed by ${question.failing} of ${question.contractors} contractors · weight ${question.weight}`
              : `${area!.questionCount} questions · programme average ${formatScore(area!.avg)} · ${area!.belowTarget} of ${area!.contractors} contractors below target`
          }
          onBack={question && area ? () => setQuestion(null) : undefined}
          onClose={close}
        >
          {question ? (
            <div className="qa">
              <p className="qa-text">{question.text}</p>
              <div className="qa-meta">
                <span>
                  <strong>{question.noCount}</strong> No
                </span>
                <span>
                  <strong>{question.partialCount}</strong> Partial
                </span>
                <span>
                  <strong>{question.lostPoints}</strong> points lost
                </span>
                {question.topIssue && (
                  <span>
                    most cited:{" "}
                    <strong>{ISSUE_BY_CODE[question.topIssue].label}</strong>
                  </span>
                )}
              </div>
              <h3 className="dd-h">
                Latest answer by contractor
                <span className="dd-h-note">worst first</span>
              </h3>
              <ul className="qa-list">
                {answers.map((a) => (
                  <li key={a.contractorId}>
                    <span className={`dd-e-answer is-${a.answer}`}>
                      {a.answer === "no"
                        ? "No"
                        : a.answer === "partial"
                          ? "Partial"
                          : a.answer === "full"
                            ? "Full"
                            : "N/A"}
                    </span>
                    <span className="qa-co">{a.label}</span>
                    <span className="qa-obs">
                      {a.issues
                        .filter((c) => c !== "GOOD")
                        .map((c) => ISSUE_BY_CODE[c].label)
                        .join(", ")}
                    </span>
                    <span className="qa-q">{quarterLabel(a.quarter)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="qa">
              <h3 className="dd-h">
                Questions in this area
                <span className="dd-h-note">
                  most widely failed first · target {TARGET_SCORE}%
                </span>
              </h3>
              <ul className="qa-list">
                {areaQuestions.map((q) => (
                  <li key={q.code}>
                    <button
                      type="button"
                      className="qa-row"
                      onClick={() => setQuestion(q)}
                    >
                      <span className="qa-code">
                        {q.code} <em>w{q.weight}</em>
                      </span>
                      <span className="qa-q-text">{q.text}</span>
                      <Share n={q.failing} of={q.contractors} />
                      <span className="dd-p-go" aria-hidden>
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </FloatingPanel>
      )}
    </div>
  );
}
