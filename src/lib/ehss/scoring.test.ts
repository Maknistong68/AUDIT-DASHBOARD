import { describe, expect, it } from "vitest";
import { CHECKLIST, WORKBOOK_FIXTURE_ANSWERS } from "./checklist";
import {
  answeredCount,
  flattenChecklist,
  scoreAudit,
  scoreQuestions,
  toResponses,
} from "./scoring";
import { ratingFor } from "./model";

describe("checklist structure", () => {
  it("has the workbook's sections and question counts", () => {
    expect(CHECKLIST.map((s) => s.code)).toEqual(["A", "B", "C"]);
    const counts = CHECKLIST.map((s) =>
      s.subSections.reduce((n, ss) => n + ss.questions.length, 0),
    );
    expect(counts).toEqual([15, 36, 30]); // A, B, C
    expect(flattenChecklist(CHECKLIST)).toHaveLength(81);
  });

  it("has B's twelve sub-sections", () => {
    const b = CHECKLIST.find((s) => s.code === "B")!;
    expect(b.subSections.map((ss) => ss.code)).toEqual([
      "B1","B2","B3","B4","B5","B6","B7","B8","B9","B10","B11","B12",
    ]);
  });
});

describe("scoring — validated against the workbook's own filled audit", () => {
  const responses = toResponses(WORKBOOK_FIXTURE_ANSWERS);
  const result = scoreAudit(CHECKLIST, responses);
  const section = (code: string) =>
    result.sections.find((s) => s.code === code)!;
  const sub = (code: string) =>
    section("B").subSections.find((ss) => ss.code === code) ??
    section("C").subSections.find((ss) => ss.code === code)!;

  it("reproduces section A = 46.94% (23 of 49 points)", () => {
    expect(section("A").score).toBe(46.94);
  });

  it("reproduces B sub-section scores", () => {
    expect(sub("B1").score).toBe(100);
    expect(sub("B2").score).toBe(92.86);
    expect(sub("B3").score).toBe(83.33);
    expect(sub("B4").score).toBe(50);
    expect(sub("B5").score).toBe(100);
    expect(sub("B6").score).toBe(33.33);
    expect(sub("B7").score).toBe(50);
    expect(sub("B8").score).toBe(50);
    expect(sub("B9").score).toBe(100); // B9.2 is N/A -> excluded
    expect(sub("B10").score).toBe(100);
    expect(sub("B11").score).toBe(85.71);
    expect(sub("B12").score).toBe(50);
  });

  it("reproduces section B = 74.60% (mean of sub-sections)", () => {
    expect(section("B").score).toBe(74.6);
  });

  it("reproduces C1 = 50%, C2 = 72%, section C = 61%", () => {
    expect(sub("C1").score).toBe(50); // seven N/A answers excluded
    expect(sub("C2").score).toBe(72);
    expect(section("C").score).toBe(61);
  });

  it("computes TOTAL = 60.85% (workbook shows 62.05 = same + manual 0.012)", () => {
    expect(result.total).toBe(60.85);
  });

  it("rates 60.85% as Minimally Compliant", () => {
    expect(ratingFor(result.total)).toBe("Minimally Compliant");
  });
});

describe("scoring edge cases", () => {
  const q = (code: string, weight: number) => ({ code, weight, text: code });

  it("scores all-Full as 100 and all-No as 0", () => {
    const qs = [q("X1", 4), q("X2", 1)];
    expect(
      scoreQuestions(qs, toResponses({ X1: "full", X2: "full" })),
    ).toBe(100);
    expect(scoreQuestions(qs, toResponses({ X1: "no", X2: "no" }))).toBe(0);
  });

  it("weights Partial at half the question weight", () => {
    // 4×0.5 + 1×1 = 3 of 5 -> 60%
    expect(
      scoreQuestions([q("X1", 4), q("X2", 1)], toResponses({ X1: "partial", X2: "full" })),
    ).toBe(60);
  });

  it("excludes N/A from numerator and denominator", () => {
    // X1 NA -> only X2 counts: 1/1 = 100%
    expect(
      scoreQuestions([q("X1", 4), q("X2", 1)], toResponses({ X1: "na", X2: "full" })),
    ).toBe(100);
  });

  it("returns null (not 0) when nothing is applicable", () => {
    expect(scoreQuestions([q("X1", 4)], toResponses({ X1: "na" }))).toBeNull();
    expect(scoreQuestions([q("X1", 4)], {})).toBeNull();
  });

  it("ignores unanswered questions rather than counting them as No", () => {
    expect(
      scoreQuestions([q("X1", 2), q("X2", 2)], toResponses({ X1: "full" })),
    ).toBe(100);
  });

  it("counts answered questions", () => {
    const { answered, total } = answeredCount(
      CHECKLIST,
      toResponses(WORKBOOK_FIXTURE_ANSWERS),
    );
    expect(total).toBe(81);
    expect(answered).toBe(81);
  });
});

describe("rating bands", () => {
  it("matches the workbook's bands", () => {
    expect(ratingFor(95)).toBe("Compliant");
    expect(ratingFor(90)).toBe("Compliant");
    expect(ratingFor(85)).toBe("Mostly Compliant");
    expect(ratingFor(75)).toBe("Moderately Compliant");
    expect(ratingFor(65)).toBe("Minimally Compliant");
    expect(ratingFor(45)).toBe("Non-Compliant");
    expect(ratingFor(null)).toBeNull();
  });
});
