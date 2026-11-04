"use client";

import { useState } from "react";
import { NOTE_MAX, noteCaution, noteProblem } from "@/lib/ehss/model";

/**
 * "What was seen" — the one free-text control in the audit.
 *
 * Written once and shared by all three places it appears (a Health & Safety
 * question, a question in any of the other seventeen checklists, and a
 * checklist area) for the same reason `QuestionRow` is shared: the rule
 * about what may be typed here is a compliance position, and a second copy
 * of this control is a second place for that rule to drift out of.
 *
 * THE CONTROL IS THE COMPLIANCE CONTROL. §2 of docs/COMPLIANCE-KSA.md used
 * to say the absence of a comments box was "structural, not a policy someone
 * has to remember". The box exists now, so the absence of IDENTIFIERS in it
 * is what has to be enforced, and it is enforced here rather than trusted:
 * a value `noteProblem()` refuses is never handed up, so it cannot be saved.
 * The rule is also printed under the field, because an auditor who is told
 * only "invalid" learns to route around the check rather than to write a
 * better observation.
 *
 * It buffers locally and commits on blur. The row it sits in unmounts when
 * the form's filter changes, so committing on every keystroke would write
 * half-typed text into the trail and a buffer that never commits would lose
 * the note on a filter click. Blur is the moment the auditor has finished.
 */
export function NoteField({
  value,
  canEdit,
  onCommit,
  label = "What was seen",
  id,
}: {
  value: string | undefined;
  canEdit: boolean;
  /** Called with the trimmed text, or "" when the field was emptied. */
  onCommit: (text: string) => void;
  label?: string;
  /** Ties the label to the control; the question or area code. */
  id: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [touched, setTouched] = useState(false);

  // A saved note with nothing to type into it still has to be readable by
  // a viewer — the panel that shows these is the dashboard, not this form.
  if (!canEdit) {
    return value ? (
      <p className="note-read">
        <span>{label}</span>
        {value}
      </p>
    ) : null;
  }

  const problem = touched ? noteProblem(draft) : null;
  const caution = touched ? noteCaution(draft) : null;
  const left = NOTE_MAX - draft.length;

  return (
    <div className="note-field">
      <label htmlFor={`note-${id}`}>
        {label} <em>optional</em>
      </label>
      <textarea
        id={`note-${id}`}
        rows={2}
        maxLength={NOTE_MAX}
        value={draft}
        placeholder="Three of eight subcontractor packs had no HSSE evaluation attached."
        onChange={(e) => {
          setDraft(e.target.value);
          setTouched(true);
        }}
        onBlur={() => {
          const text = draft.trim();
          // A refused value is never committed, so it cannot reach storage.
          // The text stays in the box so nothing the auditor wrote is lost.
          if (noteProblem(text) !== null) return;
          if (text !== (value ?? "")) onCommit(text);
        }}
      />
      <p className="note-rule">
        The condition, not the person — no names, ID numbers or contact
        details.
        {left <= 60 && <b> {left} left</b>}
      </p>
      {problem && <em className="note-problem">Not saved — {problem}</em>}
      {caution && <em className="note-caution">{caution}</em>}
    </div>
  );
}
