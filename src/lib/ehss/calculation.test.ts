import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHECKLIST } from "./checklist";
import { audits, contractors, subRegions } from "./recorded";
import { flattenChecklist, scoreRecordedAreas } from "./scoring";
import { summarizeAll } from "./summaries";

/**
 * The calculation, checked against a second implementation.
 *
 * The app's score is the only number anyone acts on, so it is not enough for
 * the engine to agree with itself. Everything below re-derives the score
 * straight from the IMPORT RECORD with plain arithmetic written out in this
 * file — no checklist, no engine, no shared helper — and requires the two to
 * agree. If someone changes the aggregation, the rounding, the area keys or
 * the generator, one of these fails.
 *
 * Deliberately independent of `recorded.test.ts`, which pins WHAT the data
 * is. This pins whether the arithmetic over it is right.
 */

const RECORD = JSON.parse(
  readFileSync(
    new URL("../../../data/hs-audits-2025Q4-2026Q1.json", import.meta.url),
    "utf8",
  ),
) as {
  audits: Array<{
    quarter: string;
    project: string;
    areas: Record<string, { scored: number; possible: number }>;
    reportedTotal: number | null;
  }>;
};

/** The one block excluded from the dataset — PPCO's figures, pasted. */
const DROPPED = (a: { quarter: string; project: string }) =>
  a.quarter === "2025-Q4" && a.project === "SIBS 838";

const SECTIONS: Record<string, string[]> = {
  A: ["A"],
  B: Array.from({ length: 12 }, (_, i) => `B${i + 1}`),
  C: ["C1", "C2"],
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** The workbook's rule, written out from scratch: points over applicable
 * weight, section = mean of its areas, total = mean of the sections. */
function independentScore(areas: Record<string, { scored: number; possible: number }>) {
  const pct = (code: string): number | null => {
    const a = areas[code];
    return a && a.possible > 0 ? round2((a.scored / a.possible) * 100) : null;
  };
  const sections: Record<string, number | null> = {};
  for (const [section, codes] of Object.entries(SECTIONS)) {
    const scored = codes
      .map(pct)
      .filter((v): v is number => v !== null);
    sections[section] = scored.length === 0 ? null : round2(mean(scored));
  }
  const scoredSections = Object.values(sections).filter(
    (v): v is number => v !== null,
  );
  return {
    sections,
    total: scoredSections.length === 0 ? null : round2(mean(scoredSections)),
  };
}

describe("the calculation", () => {
  const record = RECORD.audits.filter((a) => !DROPPED(a));

  it("covers every imported audit", () => {
    expect(record).toHaveLength(audits.length);
    expect(audits).toHaveLength(19);
  });

  it("agrees with an independent re-derivation, audit by audit", () => {
    const summaries = summarizeAll(audits, contractors, subRegions);
    // Match on the area points themselves: the app's ids are anonymized, so
    // pairing on points is the only link that does not assume the generator
    // got the identities right (recorded.test.ts covers that).
    const key = (areas: Record<string, { scored: number; possible: number }>) =>
      Object.keys(areas)
        .sort()
        .map((k) => `${k}:${areas[k]!.scored}/${areas[k]!.possible}`)
        .join("|");

    const byKey = new Map(audits.map((a) => [key(a.areaScores!), a]));
    expect(byKey.size).toBe(audits.length); // no two audits share their points

    for (const source of record) {
      const expected = independentScore(source.areas);
      const audit = byKey.get(key(source.areas));
      expect(audit, `no audit for ${source.quarter} ${source.project}`).toBeDefined();

      const engine = scoreRecordedAreas(CHECKLIST, audit!.areaScores!);
      expect(engine.total, `total for ${source.project}`).toBe(expected.total);
      for (const section of ["A", "B", "C"]) {
        expect(
          engine.sections.find((s) => s.code === section)!.score,
          `section ${section} for ${source.project}`,
        ).toBe(expected.sections[section]!);
      }

      // And the same number again through the summary the pages actually read.
      const summary = summaries.find((s) => s.id === audit!.id)!;
      expect(summary.total).toBe(expected.total);
      expect(summary.overall).toBe(expected.total);
    }
  });

  it("never produces a score outside 0-100", () => {
    for (const a of audits) {
      const score = scoreRecordedAreas(CHECKLIST, a.areaScores!);
      const all = [
        score.total,
        ...score.sections.map((s) => s.score),
        ...score.sections.flatMap((s) => s.subSections.map((ss) => ss.score)),
      ].filter((v): v is number => v !== null);
      for (const v of all) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it("never scores more points than were applicable", () => {
    // The source sheet had one area scored 21.5 out of 21; the importer caps
    // it and records the problem. Anything over 100% would be a broken score,
    // so it must not reach the dataset.
    for (const a of audits) {
      for (const [code, area] of Object.entries(a.areaScores!)) {
        expect(area.scored, `${a.id} ${code}`).toBeLessThanOrEqual(area.possible);
        expect(area.scored, `${a.id} ${code}`).toBeGreaterThanOrEqual(0);
        expect(area.possible, `${a.id} ${code}`).toBeGreaterThan(0);
      }
    }
  });

  it("loses less than a hundredth of a point to rounding at each level", () => {
    // The engine rounds area, then section, then total — as the workbook's
    // own cells do. Worth proving that compounding does not drift: if a
    // future change rounds somewhere new, this is what catches it.
    for (const a of audits) {
      const pct = Object.fromEntries(
        Object.entries(a.areaScores!).map(([k, v]) => [
          k,
          (v.scored / v.possible) * 100,
        ]),
      );
      const fullPrecision = mean(
        Object.values(SECTIONS)
          .map((codes) => codes.filter((c) => c in pct).map((c) => pct[c]!))
          .filter((xs) => xs.length > 0)
          .map(mean),
      );
      const engine = scoreRecordedAreas(CHECKLIST, a.areaScores!).total!;
      expect(Math.abs(fullPrecision - engine)).toBeLessThan(0.01);
    }
  });

  it("lets answers override an imported audit's area points", () => {
    // Area points stand in for an audit nobody recorded question by question.
    // Once someone answers the checklist, that is the audit — a score that
    // refused to move would be silently wrong toward the old number.
    const imported = audits[0]!;
    expect(imported.areaScores).toBeDefined();
    const fromAreas = summarizeAll(
      [imported],
      contractors,
      subRegions,
    )[0]!;
    expect(fromAreas.fromAreaScores).toBe(true);

    const everythingFull = Object.fromEntries(
      flattenChecklist(CHECKLIST).map(({ question }) => [
        question.code,
        { answer: "full" as const, issues: [] },
      ]),
    );
    const answered = summarizeAll(
      [{ ...imported, responses: everythingFull }],
      contractors,
      subRegions,
    )[0]!;
    expect(answered.total).toBe(100);
    expect(answered.fromAreaScores).toBe(false);
  });

  it("drops an area the sheet left blank instead of scoring it zero", () => {
    // A missing area must not pull the section down. SIBS Q1 2026 has no B5.
    const sibs = audits.find((a) => a.id === "sibs838-2026-Q1")!;
    expect(sibs.areaScores!["B5"]).toBeUndefined();

    const withB5 = scoreRecordedAreas(CHECKLIST, {
      ...sibs.areaScores!,
      B5: { scored: 0, possible: 4 },
    });
    const without = scoreRecordedAreas(CHECKLIST, sibs.areaScores!);
    // Adding a zero-scored area must LOWER the score. If the two matched,
    // a blank would already be counting as a zero somewhere.
    expect(withB5.total!).toBeLessThan(without.total!);
  });
});
