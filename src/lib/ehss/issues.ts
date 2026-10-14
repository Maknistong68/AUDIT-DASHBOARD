/**
 * Issue categories — WHY a requirement was not met.
 *
 * The checklist says WHAT was assessed and the answer says HOW BADLY, but
 * neither says why, and "why" is the only part that tells management who
 * fixes it. So the auditor categorises every Partial or No at the moment of
 * entry, choosing from this fixed list — never free text, which cannot be
 * counted and is how personal data gets into an audit tool.
 *
 * A finding may carry SEVERAL categories. A permit signed by an untrained
 * supervisor and never filed is a competence problem and an implementation
 * problem at once; forcing one label would lose half the finding.
 *
 * SEVEN, not twelve (owner's direction, 2026-10-14). Three rules decide the
 * list, and the third is what cut it:
 *
 * 1. **Every category implies a different fix and a different owner.** If
 *    two would send the same person to do the same thing, they are one.
 * 2. **Nothing here is specific to Health & Safety.** All five audits use
 *    this taxonomy, so a programme-wide report can compare across them.
 * 3. **A category is a CAUSE, never a PLACE.** Where a finding sits is the
 *    checklist area; why it happened is this list. Mixing the two axes
 *    double-counts: "subcontractor control" was a category and is an area
 *    (B6), so a missing subcontractor assessment was being filed as its own
 *    cause when it is really a Documentation failure that happens to sit in
 *    B6. Keeping them apart lets a report say "our B6 problem is 70%
 *    documentation" — which names the fix. It could not before.
 *
 * Seven is also the readable ceiling: past about seven classes carrying
 * meaning, adjacent ones blur and a table beats a chart.
 */

export type IssueCode =
  | "DOC"
  | "PLN"
  | "IMP"
  | "CMP"
  | "SUP"
  | "RES"
  | "LED"
  | "GOOD";

export interface IssueCategory {
  code: IssueCode;
  /** One or two words, readable in a chart without a legend. */
  label: string;
  /** One line, in the words a director would use. */
  description: string;
  /** Who typically has to act. Printed beside the finding so a report
   * answers "whose is this" without anyone interpreting it. */
  owner: string;
  /** false for the one positive category. */
  gap: boolean;
}

export const ISSUE_CATEGORIES: IssueCategory[] = [
  {
    code: "DOC",
    label: "Documentation",
    description:
      "The plan, permit, certificate or record does not exist, is not approved, or has expired.",
    owner: "Contractor EHSS management",
    gap: true,
  },
  {
    code: "PLN",
    label: "Planning",
    description:
      "The work began without being planned, risk-assessed or sequenced.",
    owner: "Planning and engineering",
    gap: true,
  },
  {
    code: "IMP",
    label: "Implementation",
    description:
      "It exists on paper and is not happening in the field.",
    owner: "Site management",
    gap: true,
  },
  {
    code: "CMP",
    label: "Competence",
    description:
      "People are not trained, qualified or formally appointed for the task.",
    owner: "Training and HR",
    gap: true,
  },
  {
    code: "SUP",
    label: "Supervision",
    description:
      "Nobody is checking — no supervisor at the work, or the inspection regime is not running.",
    owner: "Site supervision",
    gap: true,
  },
  {
    code: "RES",
    label: "Resources",
    description:
      "Not enough people or equipment, or the equipment provided is unfit.",
    owner: "Contractor commercial",
    gap: true,
  },
  {
    code: "LED",
    label: "Leadership",
    description:
      "Management is not visibly engaged, and nothing follows a finding.",
    owner: "Contractor senior management",
    gap: true,
  },
  {
    code: "GOOD",
    label: "Good practice",
    description:
      "Worth repeating elsewhere on the programme. Not a gap.",
    owner: "—",
    gap: false,
  },
];

export const ISSUE_BY_CODE: Record<IssueCode, IssueCategory> =
  Object.fromEntries(ISSUE_CATEGORIES.map((c) => [c.code, c])) as Record<
    IssueCode,
    IssueCategory
  >;

/** The gap categories — everything except the positive one. */
export const GAP_CATEGORIES = ISSUE_CATEGORIES.filter((c) => c.gap);

export const isGapCode = (code: IssueCode) => ISSUE_BY_CODE[code].gap;

/**
 * Codes written before a taxonomy change, mapped to their nearest survivor.
 *
 * Nothing is expanded into a guess nobody made: a record that said REC said
 * "the paperwork is wrong", which is DOC, and that is all it said. SUB is
 * the one that loses information — it recorded a PLACE, and the place is
 * already on the finding as its checklist area, so mapping it to IMP keeps
 * the likeliest cause and drops a duplicate of the area.
 */
const LEGACY: Record<string, IssueCode> = {
  // The superseded single-select codes.
  OB1: "GOOD",
  OB2: "DOC",
  OB3: "IMP",
  OB4: "CMP",
  OB5: "SUP",
  // The twelve-category taxonomy.
  TRN: "CMP", // training & competence -> Competence
  INS: "SUP", // inspection & checks -> Supervision: both are "nobody checked"
  EQP: "RES", // equipment & facilities -> Resources: the same purchase order
  REC: "DOC", // records & reporting -> Documentation: the same filing cabinet
  COM: "LED", // communication -> Leadership: management did not tell people
  SUB: "IMP", // subcontractor control was a PLACE, not a cause; see above
};

/** Read a stored response's categories, accepting every earlier shape. */
export function readIssues(value: unknown): IssueCode[] {
  const out: IssueCode[] = [];
  const add = (code: IssueCode) => {
    if (!out.includes(code)) out.push(code);
  };
  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v !== "string") continue;
      if (v in ISSUE_BY_CODE) add(v as IssueCode);
      else if (v in LEGACY) add(LEGACY[v]!);
    }
    // Register order reads better than entry order wherever these are listed.
    return ISSUE_CATEGORIES.filter((c) => out.includes(c.code)).map((c) => c.code);
  }
  if (typeof value === "string") {
    if (value in ISSUE_BY_CODE) return [value as IssueCode];
    if (value in LEGACY) return [LEGACY[value]!];
  }
  return [];
}
