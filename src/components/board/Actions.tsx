"use client";

import { useState } from "react";
import {
  MANUAL_CLOSE_REASONS,
  actionOwners,
  actionState,
  defaultTargetQuarter,
  type ActionTarget,
  type EhssAction,
  type ManualCloseReason,
} from "@/lib/ehss/actions";
import { GAP_CATEGORIES, ISSUE_BY_CODE, type IssueCode } from "@/lib/ehss/issues";
import { quarterLabel, type EhssAudit } from "@/lib/ehss/model";
import { formatScore } from "@/lib/format";

/**
 * Raise an action against a finding.
 *
 * The causes ARE the owner — pick why it failed and the function
 * responsible follows. There is no assignee field and no notes box, and
 * that is not an omission: an owner here is a role, because people move
 * between quarters and roles do not, and because a name in this system
 * would change which laws apply to it.
 */
export function RaiseAction({
  target,
  quarter,
  suggestedCauses,
  onRaise,
  onCancel,
}: {
  target: ActionTarget;
  quarter: string;
  /** Causes already on record for this finding, pre-selected. */
  suggestedCauses: IssueCode[];
  onRaise: (input: { causes: IssueCode[]; targetQuarter: string }) => void;
  onCancel: () => void;
}) {
  const [causes, setCauses] = useState<IssueCode[]>(suggestedCauses);
  const [targetQuarter, setTargetQuarter] = useState(
    defaultTargetQuarter(quarter),
  );

  const owners = actionOwners({
    id: "",
    contractorId: "",
    target,
    raisedQuarter: quarter,
    targetQuarter,
    causes,
  });

  return (
    <div className="act-raise">
      <p className="act-raise-head">
        Action against <b>{target.label}</b>
      </p>
      <span className="q-detail-label">
        Why? <em>pick every cause that applies</em>
        {causes.length === 0 && <strong className="q-required">required</strong>}
      </span>
      <div className="issue-picker" role="group" aria-label="Causes">
        {GAP_CATEGORIES.map((c) => (
          <button
            key={c.code}
            type="button"
            aria-pressed={causes.includes(c.code)}
            title={`${c.description} — ${c.owner}`}
            onClick={() =>
              setCauses((prev) =>
                prev.includes(c.code)
                  ? prev.filter((x) => x !== c.code)
                  : GAP_CATEGORIES.map((g) => g.code).filter(
                      (g) => prev.includes(g) || g === c.code,
                    ),
              )
            }
          >
            <b>{c.code}</b> {c.label}
          </button>
        ))}
      </div>

      <div className="act-raise-foot">
        <label className="field">
          <span>Close by</span>
          <select
            value={targetQuarter}
            onChange={(e) => setTargetQuarter(e.target.value)}
          >
            {[1, 2, 3, 4].reduce<string[]>((acc) => {
              const last = acc[acc.length - 1] ?? quarter;
              return [...acc, defaultTargetQuarter(last)];
            }, []).map((q) => (
              <option key={q} value={q}>
                {quarterLabel(q)}
              </option>
            ))}
          </select>
        </label>
        <span className="act-owner">
          {owners.length > 0 ? owners.join(" · ") : "pick a cause to set the owner"}
        </span>
        <span className="spacer" />
        <button className="ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary"
          type="button"
          disabled={causes.length === 0}
          onClick={() => onRaise({ causes, targetQuarter })}
        >
          Raise
        </button>
      </div>
    </div>
  );
}

/**
 * The register for one contractor.
 *
 * Status is computed on every render rather than stored, so a register
 * cannot show "closed" for something the next review found open again —
 * which is the failure mode of every action tracker anyone has been made
 * to use.
 */
export function ActionList({
  actions,
  reviews,
  currentQuarter,
  onClose,
  onReopen,
  onDelete,
}: {
  actions: EhssAction[];
  reviews: EhssAudit[];
  currentQuarter: string;
  onClose: (id: string, reason: ManualCloseReason) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [closing, setClosing] = useState<string | null>(null);

  if (actions.length === 0) return null;

  const ranked = actions
    .map((a) => ({ action: a, state: actionState(a, reviews, currentQuarter) }))
    .sort((a, b) => {
      const rank = (s: string) =>
        s === "overdue" ? 0 : s === "open" ? 1 : s === "closed-without-evidence" ? 2 : 3;
      return rank(a.state.status) - rank(b.state.status);
    });

  return (
    <ul className="act-list">
      {ranked.map(({ action, state }) => {
        const owners = actionOwners(action);
        return (
          <li key={action.id} className={`is-${state.status}`}>
            <div className="act-row">
              <span className="act-main">
                <b>{action.target.label}</b>
                <em>
                  {owners.join(" · ") || "no owner"} · raised{" "}
                  {quarterLabel(action.raisedQuarter)}
                  {action.causes.length > 0 &&
                    ` · ${action.causes.map((c) => ISSUE_BY_CODE[c]?.code ?? c).join(" ")}`}
                </em>
              </span>
              <span className="act-state">
                {state.status === "closed-by-review" && (
                  <>
                    <b>closed</b>
                    <em>
                      {quarterLabel(state.evidence!.quarter)}{" "}
                      {formatScore(state.evidence!.score)}
                    </em>
                  </>
                )}
                {state.status === "closed-without-evidence" && (
                  <>
                    <b>closed by hand</b>
                    <em>no review evidence</em>
                  </>
                )}
                {state.status === "overdue" && (
                  <>
                    <b>overdue</b>
                    <em>
                      due {quarterLabel(action.targetQuarter)} · {state.overdueBy}{" "}
                      quarter{state.overdueBy === 1 ? "" : "s"}
                    </em>
                  </>
                )}
                {state.status === "open" && (
                  <>
                    <b>open</b>
                    <em>due {quarterLabel(action.targetQuarter)}</em>
                  </>
                )}
              </span>
            </div>

            {closing === action.id ? (
              <div className="act-close">
                {MANUAL_CLOSE_REASONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    title={r.description}
                    onClick={() => {
                      onClose(action.id, r.id);
                      setClosing(null);
                    }}
                  >
                    {r.label}
                  </button>
                ))}
                <button type="button" onClick={() => setClosing(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="act-close">
                {state.status === "closed-without-evidence" ? (
                  <button type="button" onClick={() => onReopen(action.id)}>
                    Reopen
                  </button>
                ) : state.status === "closed-by-review" ? null : (
                  <button type="button" onClick={() => setClosing(action.id)}>
                    Close by hand
                  </button>
                )}
                <button type="button" onClick={() => onDelete(action.id)}>
                  Remove
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
