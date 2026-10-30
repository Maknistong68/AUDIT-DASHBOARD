/**
 * Name patterns — what a person's name looks like in observation text.
 *
 * Auditors type observations into Excel, and a name typed into one ("Mr.
 * Mahmoud Ahmed was operating the MEWP") is personal data the app must never
 * hold. The importer strips these before anything is stored. Today the
 * definition is used by the import checks and the tests; nothing in the app
 * calls it at runtime yet. It will guard auditor entry in phase 5.
 *
 * ONE DEFINITION, TWO READERS. The importer is Python and runs before the
 * app sees the file, so the pattern lives in `name-patterns.json`, which
 * both languages read. Matching is driven by the `pattern` regex in that
 * JSON, a single regex source that means the same in JavaScript and Python;
 * `titles` documents the titles it covers and a test ties the two together.
 * Three things make that true:
 * - Boundaries are explicit character classes, never `\b`: the engines
 *   disagree on what a word character is once text is not ASCII.
 * - Whitespace is an explicit class, not `\s`, for the same reason.
 * - Case is spelled out as character classes, not an `i` flag. Ms and Miss
 *   are case-sensitive on purpose: "MS Excel" and "miss Friday" are not names.
 *
 * Letters are ASCII plus Latin-1 accented letters. Arabic-script names are
 * OUT OF SCOPE for this pattern; a later human read-through is what catches
 * them. Change a title in the JSON (both `pattern` and `titles`, which the
 * test keeps in step), never by editing a regex here.
 *
 * Deliberately narrow. A title followed by a capitalised word is a name; a
 * lone title, or one followed by lower case ("Dr. pepper"), is not. Missing
 * a name is the failure this exists to prevent, so a name word takes any
 * capitalised word with letters, apostrophes or hyphens ("AHMED", "McDonald",
 * "Al-Harbi", "O'Brien"), and a lowercase particle ("bin", "al") may join
 * two of them. A particle never ends a match.
 */

import patterns from "./name-patterns.json";

const NAME = new RegExp(patterns.pattern, "g");

/** Every name span in `text`, e.g. ["Mr. Mahmoud Ahmed"]. */
export function findNames(text: string): string[] {
  return text.match(NAME) ?? [];
}

/** `text` with every name replaced by the neutral wording, and how many were replaced. */
export function removeNames(text: string): { text: string; removed: number } {
  let removed = 0;
  const out = text.replace(NAME, () => {
    removed += 1;
    return patterns.replacement;
  });
  return { text: out, removed };
}
