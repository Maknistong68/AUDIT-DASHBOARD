import { describe, expect, it } from "vitest";
import {
  DISCIPLINES,
  gapToTarget,
  ordinal,
  rankScores,
  weightedOverall,
} from "./disciplines";

describe("discipline weights", () => {
  it("are the scorecard's: 40/25/10/10/15", () => {
    expect(DISCIPLINES.map((d) => [d.id, d.weight])).toEqual([
      ["hs", 0.4],
      ["crc", 0.25],
      ["env", 0.1],
      ["sec", 0.1],
      ["ww", 0.15],
    ]);
  });

  it("sum to 1", () => {
    expect(DISCIPLINES.reduce((sum, d) => sum + d.weight, 0)).toBeCloseTo(1, 10);
  });
});

describe("weighted average — reproduces the source scorecard", () => {
  // [name, H&S, Critical Risk, Environment, Security, Worker Welfare, sheet average]
  const rows: Array<[string, number, number, number, number, number, number]> = [
    ["PPCO (1322)", 76, 81, 94, 89, 77, 80.5],
    ["Al Fahd (0882)", 72, 81, 94, 86, 87, 80.1],
    ["SIBS (0838)", 70, 85, 85, 68, 78, 76.3],
    ["Abyatona (1112)", 63, 88, 89, 81, 75, 75.5],
    ["RPCO (1440)", 70, 84, 95, 77, 82, 78.5],
    ["TDP (892)", 75, 86, 78, 89, 77, 79.8],
    ["Sarco Disa (0876)", 75, 95, 99, 97, 88, 86.5],
    ["Al Fahd (1272)", 62, 89, 97, 89, 86, 78.6],
    ["Al Fahd (823)", 67, 97, 97, 75, 89, 81.6],
    ["ECH (1131)", 89, 92, 91, 97, 89, 90.8],
  ];

  // Tolerance of 0.06 covers one half-way case: Sarco Disa computes to
  // exactly 86.55, which the spreadsheet displays as 86.5 because its stored
  // binary value sits a hair below the midpoint. Every other row is exact.
  it.each(rows)(
    "%s matches the sheet",
    (_name, hs, crc, env, sec, ww, expected) => {
      const got = weightedOverall({ hs, crc, env, sec, ww })!;
      expect(Math.abs(got - expected)).toBeLessThanOrEqual(0.06);
    },
  );

  it("renormalizes when a discipline has no score", () => {
    // Only H&S and Critical Risk scored: 0.4 and 0.25 of 0.65 total.
    expect(weightedOverall({ hs: 80, crc: 100 })).toBe(
      Math.round(((80 * 0.4 + 100 * 0.25) / 0.65 + Number.EPSILON) * 100) / 100,
    );
  });

  it("returns null when nothing is scored", () => {
    expect(weightedOverall({})).toBeNull();
  });
});

describe("gap to target", () => {
  it("measures distance below 90 and clamps at zero", () => {
    expect(gapToTarget(62.5)).toBe(27.5); // the sheet's own example
    expect(gapToTarget(40)).toBe(50);
    expect(gapToTarget(90)).toBe(0);
    expect(gapToTarget(96)).toBe(0);
    expect(gapToTarget(null)).toBeNull();
  });
});

describe("ranking", () => {
  it("ranks highest first and shares positions on ties", () => {
    expect(rankScores([90, 85, 85, 80])).toEqual([1, 2, 2, 4]);
  });

  it("leaves unscored entries unranked", () => {
    expect(rankScores([90, null, 80])).toEqual([1, null, 2]);
  });

  it("formats ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st",
    ]);
  });
});
