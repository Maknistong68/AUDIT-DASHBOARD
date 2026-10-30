/**
 * Name patterns — what a person's name looks like in observation text.
 *
 * Auditors type observations into Excel, and a name typed into one ("Mr.
 * Mahmoud Ahmed was operating the MEWP") is personal data the app must never
 * hold. The importer strips these before anything is stored, and the app
 * uses the same definition for any text it prints.
 *
 * ONE DEFINITION, TWO READERS. The importer is Python and runs before the
 * app sees the file, so the pattern lives in `name-patterns.json`, which
 * both languages read. It is a single regex source that means the same in
 * JavaScript and Python: the title's case is spelled out as character
 * classes instead of an `i` flag (the two engines do not agree on flags),
 * and there is no lookbehind or named group. Change a title in the JSON,
 * never by editing a regex here.
 *
 * Deliberately narrow. A title followed by a capitalised word is a name; a
 * lone title, or one followed by lower case ("Dr. pepper"), is not. Missing
 * a name is the failure this exists to prevent, but a pattern that rewrote
 * "Mr" in ordinary prose would corrupt the observation, so it requires the
 * shape of a name and no more.
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
