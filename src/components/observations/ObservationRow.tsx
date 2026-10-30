"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { quarterLabel } from "@/lib/ehss/model";
import {
  GAP_CATEGORIES,
  ISSUE_BY_CODE,
  type IssueCode,
} from "@/lib/ehss/issues";
import type { LogRow } from "@/lib/ehss/observation-log";

const KIND_LABEL = { gap: "Gap", positive: "Positive", site: "Site" } as const;
const KIND_TONE = { gap: "warning", positive: "good", site: "" } as const;

const MAX_CAUSES = 3;

/** Toggle one cause, keeping register order so two auditors who pick the
 * same causes produce the same record. */
function toggled(causes: IssueCode[], code: IssueCode): IssueCode[] {
  const next = new Set(causes);
  if (!next.delete(code)) next.add(code);
  return GAP_CATEGORIES.map((c) => c.code).filter((c) => next.has(c));
}

/**
 * One observation. The causes are the only thing on the row that edits, and
 * the toggles cannot reach an invalid state: the last cause cannot be taken
 * off, a fourth cannot go on, and a positive is a fixed Good practice chip.
 */
export function ObservationRow({
  row,
  canWrite,
  onSetCauses,
  onReset,
}: {
  row: LogRow;
  canWrite: boolean;
  onSetCauses: (id: string, causes: IssueCode[]) => void;
  onReset: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const textId = useId();
  const positive = row.kind === "positive";

  // The expand control only appears when the collapsed text is actually cut.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const measure = () => {
      if (!open) setClipped(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, row.text]);

  return (
    <li className="obs-row">
      <div className="obs-meta">
        <b>{row.contractorName}</b>
        <span>{quarterLabel(row.quarter)}</span>
        {row.questionCode && <span className="code">{row.questionCode}</span>}
        <span className={`badge ${KIND_TONE[row.kind]}`}>
          <span className="dot" aria-hidden />
          {KIND_LABEL[row.kind]}
        </span>
        <Link className="obs-open" href={`/audits/${row.auditId}`}>
          Open report
        </Link>
      </div>
      <p ref={textRef} id={textId} className={open ? "obs-text open" : "obs-text"}>
        {row.text}
      </p>
      {(clipped || open) && (
        <button
          type="button"
          className="ghost obs-more"
          aria-expanded={open}
          aria-controls={textId}
          onClick={() => setOpen(!open)}
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
      <div className="obs-causes">
        {positive ? (
          <span className="issue-chips">
            <i>{ISSUE_BY_CODE.GOOD.label}</i>
          </span>
        ) : canWrite ? (
          <div
            className="obs-picker"
            role="group"
            aria-label={`Causes for ${row.contractorName} ${row.questionCode ?? "observation"}`}
          >
            {GAP_CATEGORIES.map((c) => {
              const on = row.causes.includes(c.code);
              const last = on && row.causes.length === 1;
              const full = !on && row.causes.length >= MAX_CAUSES;
              const reason = last
                ? "At least one cause is required"
                : full
                  ? `At most ${MAX_CAUSES} causes`
                  : c.description;
              return (
                <button
                  key={c.code}
                  type="button"
                  aria-pressed={on}
                  disabled={last || full}
                  title={reason}
                  aria-label={`${c.code} ${c.label}${last || full ? `. ${reason}` : ""}`}
                  onClick={() => onSetCauses(row.id, toggled(row.causes, c.code))}
                >
                  <b>{c.code}</b> {c.label}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="issue-chips">
            {row.causes.map((c) => (
              <i key={c} title={ISSUE_BY_CODE[c].description}>
                {ISSUE_BY_CODE[c].label}
              </i>
            ))}
          </span>
        )}
        {canWrite && row.causesSource === "auditor" && (
          <button type="button" className="ghost obs-reset" aria-label="Reset to the recorded causes" onClick={() => onReset(row.id)}>
            Reset
          </button>
        )}
      </div>
    </li>
  );
}
