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
 * supervisor and never filed is a competence problem, a records problem and
 * an implementation problem at once; forcing one label would lose two
 * thirds of the finding.
 *
 * Two design rules hold this list together:
 *
 * 1. **Every category implies a different fix and a different owner.** If
 *    two categories would send the same person to do the same thing, they
 *    are one category. That is why the list is twelve and not forty.
 * 2. **Nothing here is specific to Health & Safety.** All five audits —
 *    H&S, Critical Risk Control, Environment, Security and Worker Welfare —
 *    use this same taxonomy, so a programme-wide report can say "38% of our
 *    findings across every discipline are subcontractor control" and mean
 *    it. Categories that only made sense for one discipline were rejected.
 */

export type IssueCode =
  | "DOC"
  | "IMP"
  | "PLN"
  | "TRN"
  | "SUP"
  | "RES"
  | "EQP"
  | "SUB"
  | "INS"
  | "REC"
  | "COM"
  | "LED"
  | "GOOD";

export interface IssueCategory {
  code: IssueCode;
  /** Two or three words, readable in a table without a legend. */
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
      "The required plan, permit, certificate or record does not exist, is not approved, or has expired.",
    owner: "Contractor EHSS management",
    gap: true,
  },
  {
    code: "IMP",
    label: "Implementation",
    description:
      "The requirement exists on paper but is not being followed in the field.",
    owner: "Site management",
    gap: true,
  },
  {
    code: "PLN",
    label: "Planning",
    description:
      "The work started without being properly planned, risk-assessed or sequenced.",
    owner: "Planning and engineering",
    gap: true,
  },
  {
    code: "TRN",
    label: "Training & competence",
    description:
      "The people doing the work are not trained, certified or assessed as competent for it.",
    owner: "Training function",
    gap: true,
  },
  {
    code: "SUP",
    label: "Supervision",
    description:
      "There is not enough competent supervision present for the work being done.",
    owner: "Contractor leadership",
    gap: true,
  },
  {
    code: "RES",
    label: "Resources",
    description:
      "Not enough people, equipment, facilities or budget allocated to meet the requirement.",
    owner: "Contractor leadership",
    gap: true,
  },
  {
    code: "EQP",
    label: "Equipment & facilities",
    description:
      "Equipment or facilities are defective, uncertified, poorly maintained or unsuitable for the task.",
    owner: "Plant and maintenance",
    gap: true,
  },
  {
    code: "SUB",
    label: "Subcontractor control",
    description:
      "The gap sits with a subcontractor the main contractor is not adequately controlling.",
    owner: "Main contractor",
    gap: true,
  },
  {
    code: "INS",
    label: "Inspection & checks",
    description:
      "Required inspections, tests, drills or self-audits are not being carried out.",
    owner: "Contractor EHSS team",
    gap: true,
  },
  {
    code: "REC",
    label: "Records & reporting",
    description:
      "It happened but was not logged, reported, escalated or tracked through to closure.",
    owner: "Contractor EHSS team",
    gap: true,
  },
  {
    code: "COM",
    label: "Communication",
    description:
      "Briefings, signage, alerts or language barriers mean the requirement has not reached the workforce.",
    owner: "Site management",
    gap: true,
  },
  {
    code: "LED",
    label: "Leadership",
    description:
      "Management presence, participation or visible commitment to the requirement is missing.",
    owner: "Senior management",
    gap: true,
  },
  {
    code: "GOOD",
    label: "Good practice",
    description:
      "Requirement fully met, with evidence of practice beyond the minimum.",
    owner: "—",
    gap: false,
  },
];

export const ISSUE_BY_CODE: Record<IssueCode, IssueCategory> =
  Object.fromEntries(
    ISSUE_CATEGORIES.map((c) => [c.code, c]),
  ) as Record<IssueCode, IssueCategory>;

/** The twelve gap categories, in picker order. */
export const GAP_CATEGORIES = ISSUE_CATEGORIES.filter((c) => c.gap);

export const isGapCode = (code: IssueCode) => ISSUE_BY_CODE[code].gap;

/**
 * Legacy OB1–OB5 mapped onto this list.
 *
 * The old taxonomy was single-select and had four gap codes, two of which
 * bundled several causes: OB4 covered staffing, supervision AND training,
 * OB5 covered inspection AND reporting. Each maps to its closest single
 * category rather than being expanded, because guessing which half of a
 * bundled code an auditor meant would invent findings that were never
 * recorded.
 */
const LEGACY: Record<string, IssueCode> = {
  OB1: "GOOD",
  OB2: "DOC",
  OB3: "IMP",
  OB4: "TRN",
  OB5: "INS",
};

/** Read a stored response's categories, accepting the pre-taxonomy shape. */
export function readIssues(value: unknown): IssueCode[] {
  if (Array.isArray(value)) {
    return value.filter(
      (v): v is IssueCode =>
        typeof v === "string" && v in ISSUE_BY_CODE,
    );
  }
  if (typeof value === "string" && value in LEGACY) return [LEGACY[value]!];
  return [];
}
