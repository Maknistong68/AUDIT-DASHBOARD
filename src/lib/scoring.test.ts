import { describe, expect, it } from "vitest";
import { computeScore, ncCategoryBreakdown, trendDelta } from "./scoring";
import type { ScorableResponse } from "./types";

const fc = (weight = 1): ScorableResponse => ({ result: "full_compliance", weight });
const nc = (weight = 1): ScorableResponse => ({ result: "non_compliance", weight });
const na = (weight = 1): ScorableResponse => ({ result: "not_applicable", weight });

describe("computeScore", () => {
  it("scores all full compliance as 100", () => {
    expect(computeScore([fc(), fc(), fc()])).toBe(100);
  });

  it("scores all non-compliance as 0", () => {
    expect(computeScore([nc(), nc()])).toBe(0);
  });

  it("excludes not-applicable from the calculation", () => {
    // 3 FC, 1 NC, 1 NA -> 3/4 = 75 (mirrors the DB smoke test)
    expect(computeScore([fc(), fc(), fc(), nc(), na()])).toBe(75);
  });

  it("returns null for an empty audit", () => {
    expect(computeScore([])).toBeNull();
  });

  it("returns null when every question is not applicable", () => {
    expect(computeScore([na(), na()])).toBeNull();
  });

  it("applies question weights", () => {
    // FC weight 3, NC weight 1 -> 3/4 = 75
    expect(computeScore([fc(3), nc(1)])).toBe(75);
    // FC weight 1, NC weight 3 -> 1/4 = 25
    expect(computeScore([fc(1), nc(3)])).toBe(25);
  });

  it("rounds to two decimals", () => {
    // 1 FC of 3 applicable -> 33.333... -> 33.33
    expect(computeScore([fc(), nc(), nc()])).toBe(33.33);
    // 2 FC of 3 applicable -> 66.666... -> 66.67
    expect(computeScore([fc(), fc(), nc()])).toBe(66.67);
  });

  it("rejects non-positive weights", () => {
    expect(() => computeScore([fc(0)])).toThrow(/invalid question weight/);
    expect(() => computeScore([fc(-1)])).toThrow(/invalid question weight/);
  });
});

describe("trendDelta", () => {
  it("returns latest minus earliest regardless of input order", () => {
    expect(
      trendDelta([
        { auditDate: "2026-06-01", score: 78 },
        { auditDate: "2026-01-01", score: 62 },
        { auditDate: "2026-09-01", score: 91 },
      ]),
    ).toBe(29);
  });

  it("returns null with fewer than two points", () => {
    expect(trendDelta([])).toBeNull();
    expect(trendDelta([{ auditDate: "2026-01-01", score: 50 }])).toBeNull();
  });

  it("can be negative when compliance declines", () => {
    expect(
      trendDelta([
        { auditDate: "2026-01-01", score: 90 },
        { auditDate: "2026-06-01", score: 70.5 },
      ]),
    ).toBe(-19.5);
  });
});

describe("ncCategoryBreakdown", () => {
  it("counts and ranks NC classifications with their share", () => {
    const rows = [
      { ncCategoryName: "Incomplete Documentation / Missing Requirements" },
      { ncCategoryName: "Incomplete Documentation / Missing Requirements" },
      { ncCategoryName: "Incomplete Documentation / Missing Requirements" },
      { ncCategoryName: "Documentation Not Available" },
      { ncCategoryName: "Not Implemented" },
    ];
    expect(ncCategoryBreakdown(rows)).toEqual([
      { name: "Incomplete Documentation / Missing Requirements", count: 3, share: 60 },
      { name: "Documentation Not Available", count: 1, share: 20 },
      { name: "Not Implemented", count: 1, share: 20 },
    ]);
  });

  it("returns an empty array for no NCs", () => {
    expect(ncCategoryBreakdown([])).toEqual([]);
  });
});
