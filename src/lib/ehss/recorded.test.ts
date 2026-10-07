import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { audits, contractors, subRegions } from "./recorded";
import { CHECKLIST } from "./checklist";
import { scoreRecordedAreas } from "./scoring";
import { contractorLabel } from "./model";
import { checklistAreas, summarizeAll, windowByContractor } from "./summaries";

/**
 * The real Q4 2025 / Q1 2026 Health & Safety audits.
 *
 * These pin the two things an import can silently get wrong: WHO an audit
 * belongs to, and WHAT it scores. The sheet spelled one contractor three
 * ways and pasted one contractor's row under another's name, so both are
 * pinned here rather than left to a reviewer's eye.
 */
describe("the recorded dataset", () => {
  it("holds 19 audits over two quarters for 13 contractors", () => {
    expect(audits).toHaveLength(19);
    expect(contractors).toHaveLength(13);
    expect([...new Set(audits.map((a) => a.quarter))].sort()).toEqual([
      "2025-Q4",
      "2026-Q1",
    ]);
    expect(new Set(audits.map((a) => a.id)).size).toBe(audits.length);
  });

  it("identifies contractors by initials and the work order's last three digits", () => {
    expect(contractors.map(contractorLabel).sort()).toEqual([
      "AB (901)",
      "ABYA (112)",
      "ABYA (134)",
      "AF (272)",
      "AF (882)",
      "ECH (131)",
      "NBC (026)",
      "OT2 (D&B)",
      "PPCO (322)",
      "RPCO (440)",
      "SD (876)",
      "SIBS (838)",
      "TDP (892)",
    ]);
  });

  it("names nobody and carries no work order in full", () => {
    // The determination that this data may live outside the Kingdom rests on
    // it identifying no one; a full name or work order would undo that.
    for (const c of contractors) {
      expect(c.name.length).toBeLessThanOrEqual(4);
      expect(c.code.length).toBeLessThanOrEqual(3);
    }
  });

  it("merges the sheet's three spellings of SIBS into one contractor", () => {
    // 4800000838, 800000838 (a digit short) and "SIBS 838" with no number.
    const sibs = contractors.filter((c) => c.name === "SIBS");
    expect(sibs).toHaveLength(1);
    expect(sibs[0]!.code).toBe("838");
  });

  it("drops the block that duplicates PPCO's, so SIBS has one audit a quarter", () => {
    // The unnumbered "SIBS 838" block repeated all 15 of PPCO's area scores
    // and its stated total. Keeping it would give SIBS PPCO's numbers.
    const sibs = audits.filter((a) => a.contractorId === "sibs838");
    expect(sibs.map((a) => a.quarter)).toEqual(["2025-Q4", "2026-Q1"]);
    const perQuarter = new Map<string, number>();
    for (const a of audits) {
      const key = `${a.contractorId}/${a.quarter}`;
      perQuarter.set(key, (perQuarter.get(key) ?? 0) + 1);
    }
    expect([...perQuarter.values()].every((n) => n === 1)).toBe(true);
  });

  it("records area points, never answers", () => {
    for (const a of audits) {
      expect(a.areaScores).toBeDefined();
      expect(Object.keys(a.responses)).toHaveLength(0);
      for (const [code, area] of Object.entries(a.areaScores!)) {
        expect(checklistAreas().map((x) => x.code)).toContain(code);
        expect(area.possible).toBeGreaterThan(0);
        expect(area.scored).toBeGreaterThanOrEqual(0);
        expect(area.scored).toBeLessThanOrEqual(area.possible + 0.5);
      }
    }
  });

  it("scores an area as points over applicable weight, and rolls up as the workbook does", () => {
    // RPCO Q1 2026, hand-checked against the sheet's own points columns.
    const rpco = audits.find((a) => a.id === "rpco440-2026-Q1")!;
    const score = scoreRecordedAreas(CHECKLIST, rpco.areaScores!);
    const area = (code: string) =>
      score.sections
        .flatMap((s) => s.subSections.map((ss) => ({ ...ss, section: s.code })))
        .find((ss) => (ss.code ?? ss.section) === code)?.score ?? null;

    expect(rpco.areaScores!["A"]).toEqual({ scored: 7.5, possible: 39 });
    expect(area("A")).toBeCloseTo((7.5 / 39) * 100, 2);
    expect(area("B6")).toBeCloseTo((1 / 11) * 100, 2);
    expect(score.total).toBeCloseTo(45.76, 2);

    // The sheet stated 60 for this audit — 14.2 points above its own points.
    expect(rpco.reportedTotal).toBe(60);
  });

  it("scores every audit, and reports the sheet's figure beside its own", () => {
    const all = summarizeAll(audits, contractors, subRegions);
    expect(all).toHaveLength(19);
    for (const s of all) {
      expect(s.total).not.toBeNull();
      expect(s.fromAreaScores).toBe(true);
      // Only H&S is scored, so the weighted overall renormalizes onto it
      // rather than reading a contractor down for audits nobody has run.
      expect(s.overall).toBe(s.total);
      expect(s.reportedTotal).not.toBeNull();
    }
    // The stated total disagrees with the sheet's own points in 18 of the
    // 19: nine overstate performance (by up to 14.2 points) and nine
    // understate it (by up to 4.3). Every error above 5 points is an
    // overstatement. Pinned because the app's whole value here is showing
    // the points, and a change that quietly narrowed this gap would mean
    // the app had started agreeing with the broken formula.
    const diff = (s: (typeof all)[number]) => s.reportedTotal! - s.total!;
    expect(all.filter((s) => Math.abs(diff(s)) >= 0.5)).toHaveLength(18);
    expect(all.filter((s) => diff(s) >= 0.5)).toHaveLength(9);
    expect(all.filter((s) => diff(s) <= -0.5)).toHaveLength(9);
    expect(Math.max(...all.map(diff))).toBeCloseTo(14.24, 2);
    expect(Math.min(...all.map(diff))).toBeCloseTo(-4.25, 2);
  });

  it("covers all 15 checklist areas, section A included", () => {
    const all = summarizeAll(audits, contractors, subRegions);
    const abya = all.find((s) => s.id === "abya134-2025-Q4")!;
    expect(abya.subSections.map((ss) => ss.code)).toEqual(
      checklistAreas().map((a) => a.code),
    );
    expect(abya.subSections.find((ss) => ss.code === "A")!.score).toBeCloseTo(
      60,
      2,
    );
  });

  it("keeps the synthetic fixture out of the app", () => {
    // fixture.ts carries invented numbers. A number on a director's screen
    // that nobody audited is worse than a blank, so the app must never
    // import it — only the tests may.
    const root = new URL("../../..", import.meta.url).pathname;
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")) {
          if (/from\s+["'][^"']*ehss\/fixture["']/.test(readFileSync(full, "utf8"))) {
            offenders.push(full.slice(root.length));
          }
        }
      }
    };
    walk(`${root}src/app`);
    walk(`${root}src/components`);
    expect(offenders).toEqual([]);
  });

  it("orders a contractor's window oldest first", () => {
    const all = summarizeAll(audits, contractors, subRegions);
    for (const [, list] of windowByContractor(all, "all")) {
      const dates = list.map((s) => s.auditDate);
      expect([...dates].sort()).toEqual(dates);
    }
  });
});
