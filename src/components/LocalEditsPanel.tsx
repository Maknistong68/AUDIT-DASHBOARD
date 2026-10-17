"use client";

import { useState } from "react";
import { useEhss } from "@/lib/ehss/store";

/**
 * What this browser is holding that nobody else can see — and the way to
 * drop it.
 *
 * `resetLocalEdits()` has existed in the store since the overrides layer was
 * written and was wired to nothing, which made it the only recovery path
 * from a bad local edit and also an unreachable one.
 *
 * It is a panel rather than a button because the count is the point. "Reset"
 * on its own invites a click from someone who does not know what they are
 * about to lose; "4 reviews edited in this browser only" is the sentence
 * that makes the decision for them, and it is also the clearest statement
 * anywhere in the app of what local storage actually means today. Both go
 * when the database lands.
 */
export function LocalEditsPanel() {
  const { localEdits, resetLocalEdits, hydrated, storage } = useEhss();
  const [confirming, setConfirming] = useState(false);

  // Before hydration the store reports the baseline, so a count would read
  // zero and then jump. Say nothing rather than say zero.
  if (!hydrated) return null;

  const total =
    localEdits.audits +
    localEdits.deleted +
    localEdits.contractors +
    localEdits.actions;

  // Once storage is shared this panel is answering a question nobody has:
  // the edits ARE the record, and there is nothing local to discard.
  if (storage.shared) return null;

  return (
    <section className="card">
      <h2>This browser&apos;s edits</h2>
      {total === 0 ? (
        <p className="sub">
          Nothing has been changed in this browser. Every figure on screen is
          the recorded dataset.
        </p>
      ) : (
        <>
          <p className="sub">
            {localEdits.audits > 0 && (
              <>
                <strong>{localEdits.audits}</strong> review
                {localEdits.audits === 1 ? "" : "s"} created or edited
              </>
            )}
            {localEdits.deleted > 0 && (
              <>
                {localEdits.audits > 0 && " · "}
                <strong>{localEdits.deleted}</strong> deleted
              </>
            )}
            {localEdits.contractors > 0 && (
              <>
                {(localEdits.audits > 0 || localEdits.deleted > 0) && " · "}
                <strong>{localEdits.contractors}</strong> contractor
                {localEdits.contractors === 1 ? "" : "s"} activated or
                deactivated
              </>
            )}
            {localEdits.actions > 0 && (
              <>
                {total > localEdits.actions && " · "}
                <strong>{localEdits.actions}</strong> action
                {localEdits.actions === 1 ? "" : "s"} raised
              </>
            )}
            . These are held in this browser and are visible to nobody else.
          </p>
          <p>
            {confirming ? (
              <>
                <button
                  className="primary"
                  type="button"
                  onClick={() => {
                    resetLocalEdits();
                    setConfirming(false);
                  }}
                >
                  Discard all {total}
                </button>{" "}
                <button
                  className="ghost"
                  type="button"
                  onClick={() => setConfirming(false)}
                >
                  Keep them
                </button>
              </>
            ) : (
              <button
                className="ghost"
                type="button"
                onClick={() => setConfirming(true)}
              >
                Discard this browser&apos;s edits
              </button>
            )}
          </p>
        </>
      )}
    </section>
  );
}
