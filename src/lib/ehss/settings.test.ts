import { describe, expect, it } from "vitest";
import {
  BASELINE_SETTINGS,
  addSettings,
  settingsFor,
  targetFor,
  validateSettings,
  weightsFor,
  type ProgrammeSettings,
} from "./settings";
import { DISCIPLINES, TARGET_SCORE } from "./disciplines";

const history: ProgrammeSettings[] = [
  BASELINE_SETTINGS,
  {
    effectiveFrom: "2026-Q3",
    targetScore: 95,
    weights: BASELINE_SETTINGS.weights,
    note: "Target raised for 2026/27.",
  },
];

describe("introducing settings changes no figure that exists today", () => {
  it("is exactly the constants the app already runs on", () => {
    expect(BASELINE_SETTINGS.targetScore).toBe(TARGET_SCORE);
    for (const d of DISCIPLINES) {
      expect(BASELINE_SETTINGS.weights[d.id]).toBe(d.weight);
    }
  });

  it("falls back rather than throwing for a quarter before any entry", () => {
    // A review imported from before the programme wrote anything down
    // still has to be scoreable.
    expect(targetFor([], "2025-Q4")).toBe(TARGET_SCORE);
  });
});

describe("a quarter is judged by the settings in force when it was audited", () => {
  it("does not restate a reported quarter when the target changes", () => {
    // THE TRAP THIS FILE EXISTS FOR. Raising the target to 95 from Q3 2026
    // must leave every earlier quarter judged at 90 — otherwise last
    // quarter's board silently disagrees with the minutes of the meeting
    // that discussed it, and nobody changed an audit.
    expect(targetFor(history, "2025-Q4")).toBe(90);
    expect(targetFor(history, "2026-Q1")).toBe(90);
    expect(targetFor(history, "2026-Q2")).toBe(90);
    expect(targetFor(history, "2026-Q3")).toBe(95);
    expect(targetFor(history, "2027-Q1")).toBe(95);
  });

  it("takes the latest entry that had already taken effect", () => {
    const three = [
      ...history,
      {
        effectiveFrom: "2027-Q1",
        targetScore: 97,
        weights: BASELINE_SETTINGS.weights,
      },
    ];
    expect(settingsFor(three, "2026-Q4").targetScore).toBe(95);
    expect(settingsFor(three, "2027-Q2").targetScore).toBe(97);
  });

  it("versions the weights too", () => {
    const reweighted: ProgrammeSettings = {
      effectiveFrom: "2027-Q1",
      targetScore: 90,
      weights: { hs: 0.5, crc: 0.2, env: 0.1, sec: 0.1, ww: 0.1 },
    };
    const all = [...history, reweighted];
    // Re-weighting Critical Risk would otherwise restate every overall
    // score ever shown.
    expect(weightsFor(all, "2026-Q1").hs).toBe(0.4);
    expect(weightsFor(all, "2027-Q1").hs).toBe(0.5);
  });
});

describe("what is refused before it can render a NaN", () => {
  it("rejects weights that do not sum to 100%", () => {
    const problems = validateSettings([
      {
        effectiveFrom: "2027-Q1",
        targetScore: 90,
        weights: { hs: 0.4, crc: 0.25, env: 0.1, sec: 0.1, ww: 0.3 },
      },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]!.problem).toContain("115.0%");
  });

  it("rejects a target outside 0-100 and a malformed quarter", () => {
    expect(
      validateSettings([
        { effectiveFrom: "2027-Q1", targetScore: 140, weights: BASELINE_SETTINGS.weights },
      ])[0]!.problem,
    ).toContain("between 0 and 100");
    expect(
      validateSettings([
        { effectiveFrom: "soon", targetScore: 90, weights: BASELINE_SETTINGS.weights },
      ])[0]!.problem,
    ).toContain("not a quarter");
  });

  it("rejects two entries taking effect in the same quarter", () => {
    const problems = validateSettings([
      { effectiveFrom: "2027-Q1", targetScore: 90, weights: BASELINE_SETTINGS.weights },
      { effectiveFrom: "2027-Q1", targetScore: 95, weights: BASELINE_SETTINGS.weights },
    ]);
    expect(problems.some((p) => p.problem.includes("two entries"))).toBe(true);
  });
});

describe("a change cannot be backdated into a reported quarter", () => {
  const entry: ProgrammeSettings = {
    effectiveFrom: "2026-Q1",
    targetScore: 95,
    weights: BASELINE_SETTINGS.weights,
  };

  it("refuses, and says why", () => {
    const { history: after, problems } = addSettings(
      [BASELINE_SETTINGS],
      entry,
      "2026-Q4",
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]!.problem).toContain("already reported");
    // And nothing was changed: a refusal must not half-apply.
    expect(after).toEqual([BASELINE_SETTINGS]);
  });

  it("accepts one that takes effect in an open quarter, kept in order", () => {
    const { history: after, problems } = addSettings(
      [BASELINE_SETTINGS],
      { ...entry, effectiveFrom: "2026-Q4" },
      "2026-Q4",
    );
    expect(problems).toEqual([]);
    expect(after.map((s) => s.effectiveFrom)).toEqual(["0000-Q1", "2026-Q4"]);
  });
});
