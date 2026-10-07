/**
 * Why a question-level view is empty.
 *
 * Every review on record was imported from its quarter's audit sheet, which
 * kept a score per checklist area and a narrative paragraph per question —
 * no Full/Partial/No answer and no cause. So the area scores are real and the
 * question-level analysis has nothing to work from yet.
 *
 * This is worth a sentence rather than a bare "nothing in scope": an empty
 * findings register looks like a broken app, and the honest reading is that
 * the data for it has not been collected in this form yet.
 */
export function RecordedOnlyNote({ what }: { what: string }) {
  return (
    <div className="recorded-note">
      <strong>No per-question answers on record yet.</strong> Every review here
      was imported from its quarter&apos;s audit sheet, which recorded a score
      per checklist area and a written note per question — not a
      Full&nbsp;/&nbsp;Partial&nbsp;/&nbsp;No answer with a cause. {what} The
      area scores, the checklist-area matrix and the contractor trends all work
      from the imported data as it stands.
    </div>
  );
}
