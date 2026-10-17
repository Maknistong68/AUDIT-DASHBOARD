import Link from "next/link";

/**
 * Where the numbers come from, said in the app rather than in a file nobody
 * opens.
 *
 * `docs/DATA-ASSURANCE.md` answers the director's "can I trust this?" in
 * detail and is invisible from every screen, which makes it worth exactly
 * nothing to the person asking. This is the short version, with the figures
 * from the last verification run, placed where someone forming a judgement
 * about a number can reach it.
 *
 * The figures are deliberately written out rather than computed: they are a
 * record of a verification RUN, not a live reading, and a number here that
 * silently recomputed would claim a check nobody performed.
 */
export function ProvenanceNote({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="sub prov-line">
        Scores are calculated from the audit points, and the chain from source
        sheet to this screen is verified —{" "}
        <Link href="/admin#provenance">how these numbers are produced</Link>.
      </p>
    );
  }
  return (
    <section className="card" id="provenance">
      <h2>How these numbers are produced</h2>
      <p className="sub">
        Every score on every screen is calculated from the points the auditor
        recorded. The percentages printed on the source sheets are not used:
        they disagree with their own points in 18 of the 19 imported reviews,
        nine of them overstating by up to 14.2 points.
      </p>
      <ul className="prov-list">
        <li>
          <strong>558</strong> point cells compared between the import record
          and the dataset — <em>0 differ</em>
        </li>
        <li>
          <strong>361</strong> figures scraped off these screens and compared
          to the arithmetic done independently — <em>0 differ</em>
        </li>
        <li>
          <strong>279</strong> cells re-read from the source workbook a second
          way, by searching for its own printed labels — <em>0 differ</em>
        </li>
        <li>
          The entry template computes what this app computes, checked by
          equality rather than tolerance
        </li>
      </ul>
      <p className="sub">
        Last full run 2026-10-17. The checks are in <code>scripts/</code> and
        the write-up, including what is still weak, is
        <code> docs/DATA-ASSURANCE.md</code>.
      </p>
    </section>
  );
}
