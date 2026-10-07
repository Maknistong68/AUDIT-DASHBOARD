"use client";

import { TargetBar } from "@/components/charts/Marks";
import { bandColor } from "@/lib/ehss/bands";
import { TARGET_SCORE } from "@/lib/ehss/disciplines";
import { ISSUE_BY_CODE, type IssueCode } from "@/lib/ehss/issues";

import { formatScore } from "@/lib/format";
import type {
  ChecklistQuestionStat,
  EvidenceRow,
  ProblemPeer,
  ProblemRow,
} from "@/lib/ehss/summaries";

/**
 * Drill-down level 2 — one problem, shown rather than described.
 *
 * Three questions a director asks, each answered by a shape:
 * is it getting better (the quarter bars), is it just us (the benchmark),
 * and what kind of problem is it (the cause mix). The controls inside the
 * area are bars too. Words only where a number needs a unit.
 *
 * The evidence — who wrote what, in which review — is level 3, because it
 * is the one place prose is the right answer.
 */
export function ProblemOverview({
  problem,
  peer,
  causes,
  questions,
  onOpenEvidence,
}: {
  problem: ProblemRow;
  peer: ProblemPeer | null;
  /** Issue categories across this problem's findings, most cited first. */
  causes: Array<{ code: IssueCode; count: number }>;
  /** Controls inside the area; empty for a hazard or a single question. */
  questions: ChecklistQuestionStat[];
  onOpenEvidence: () => void;
}) {
  const causeMax = Math.max(1, ...causes.map((c) => c.count));
  const hasSeries = problem.series.length > 0;
  const seriesMax = Math.max(100, ...problem.series);
  /** A hazard and a single question have no controls beneath them. With
   * nothing to list, the quarter bars move across and become the main
   * visual rather than being drawn twice at two sizes. */
  const hasQuestions = questions.length > 0;

  const quarterBars = (
    <div className="pv-quarters">
      {problem.series.map((v, i) => (
        <div className="pv-q" key={problem.quarters[i] ?? i}>
          <div className="pv-q-bar" aria-hidden>
            <i
              style={{
                height: `${(v / seriesMax) * 100}%`,
                background: bandColor(v),
              }}
            />
            <b style={{ bottom: `${(TARGET_SCORE / seriesMax) * 100}%` }} />
          </div>
          <div className="pv-q-n">{v.toFixed(0)}</div>
          <div className="pv-q-l">
            {(problem.quarters[i] ?? "").replace(/^\d{2}/, "").replace("-", " ")}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="pv">
      {/* ---- Left: how bad, and which way is it going ---- */}
      <aside className="pv-rail">
        <div className="pv-hero">
          <div className="pv-score" style={{ color: bandColor(problem.score) }}>
            {problem.score === null
              ? problem.gap.toFixed(0)
              : formatScore(problem.score)}
          </div>
          <div className="pv-sub">
            {problem.score === null
              ? "weighted points lost"
              : `${problem.gap.toFixed(1)} below the ${TARGET_SCORE}% target`}
          </div>
        </div>

        {hasSeries && hasQuestions && quarterBars}

        {peer && (
          <div className="pv-peer">
            <div className="pv-peer-head">{peer.label}</div>
            {peer.suffix === "%" ? (
              <>
                <div className="pv-peer-row">
                  <span>This contractor</span>
                  <TargetBar score={problem.score} label="This contractor" />
                  <strong>{formatScore(problem.score)}</strong>
                </div>
                <div className="pv-peer-row">
                  <span>Programme</span>
                  <TargetBar score={peer.value} label="Programme" />
                  <strong>{peer.value.toFixed(1)}%</strong>
                </div>
              </>
            ) : (
              <div className="pv-peer-count">
                <strong>
                  {peer.value}
                  {peer.suffix}
                </strong>{" "}
                contractors share this gap
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ---- Right: what kind of problem, and where inside it ---- */}
      <section className="pv-main">
        {causes.length > 0 && (
          <div className="pv-block">
            <h3 className="dd-h">
              Why
              <span className="dd-h-note">causes recorded, most cited first</span>
            </h3>
            <ul className="pv-causes">
              {causes.slice(0, 5).map((c) => (
                <li key={c.code}>
                  <span className="pv-cause-label">
                    {ISSUE_BY_CODE[c.code].label}
                  </span>
                  <span className="pv-cause-bar" aria-hidden>
                    <i style={{ width: `${(c.count / causeMax) * 100}%` }} />
                  </span>
                  <span className="pv-cause-n">{c.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pv-block pv-grow">
          <h3 className="dd-h">
            {hasQuestions ? "Which controls" : "Score by quarter"}
            <span className="dd-h-note">
              {hasQuestions
                ? `${questions.length} in this area · share of contractors failing`
                : `${problem.reviews} review${problem.reviews === 1 ? "" : "s"} · the line marks the ${TARGET_SCORE}% target`}
            </span>
          </h3>

          {hasQuestions ? (
            <ul className="pv-questions">
              {questions.slice(0, 6).map((q) => (
                <li key={q.code}>
                  <span className="pv-q-code">{q.code}</span>
                  <span className="pv-q-text" title={q.text}>
                    {q.text}
                  </span>
                  <span className="pv-q-fail" aria-hidden>
                    <i
                      style={{
                        width: `${q.failRate * 100}%`,
                        background:
                          q.failRate >= 0.6
                            ? "var(--status-critical)"
                            : q.failRate >= 0.3
                              ? "var(--status-serious)"
                              : "var(--status-warning)",
                      }}
                    />
                  </span>
                  <span className="pv-q-n">
                    {q.failing}/{q.contractors}
                  </span>
                </li>
              ))}
            </ul>
          ) : hasSeries ? (
            <div className="pv-big-quarters">{quarterBars}</div>
          ) : (
            <div className="chart-empty">Nothing recorded in this window.</div>
          )}
        </div>

        <button type="button" className="pv-more" onClick={onOpenEvidence}>
          See what the auditors recorded
          <span aria-hidden>›</span>
        </button>
      </section>
    </div>
  );
}

/** Count each issue category across a problem's findings, most cited first. */
export function causeMix(
  evidence: EvidenceRow[],
): Array<{ code: IssueCode; count: number }> {
  const counts = new Map<IssueCode, number>();
  for (const e of evidence)
    for (const code of e.issues)
      counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
}
