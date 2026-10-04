import { describe, expect, it } from "vitest";
import {
  checklistAreas,
  checklistMatrix,
  checklistQuestionStats,
  questionByContractor,
  summarizeAll,
} from "./summaries";
import { CHECKLIST } from "./checklist";
import { flattenChecklist } from "./scoring";
import { audits, contractors, subRegions } from "./mock";
import { TARGET_SCORE } from "./disciplines";

const summaries = summarizeAll(audits, contractors, subRegions);

describe("checklist areas", () => {
  it("treats section A as one area and every sub-section as its own", () => {
    const areas = checklistAreas();
    expect(areas.map((a) => a.code)).toEqual([
      "A",
      "B1","B2","B3","B4","B5","B6","B7","B8","B9","B10","B11","B12",
      "C1","C2",
    ]);
  });

  it("accounts for all 81 questions exactly once", () => {
    const total = checklistAreas().reduce((n, a) => n + a.questionCount, 0);
    expect(total).toBe(flattenChecklist(CHECKLIST).length);
    expect(total).toBe(81);
  });

  it("carries each area's real title", () => {
    const areas = checklistAreas();
    expect(areas.find((a) => a.code === "A")!.title).toBe("Management");
    expect(areas.find((a) => a.code === "B6")!.title).toBe(
      "Subcontractor Management",
    );
  });
});

describe("the contractor x area matrix", () => {
  const { areas, contractors: roster } = checklistMatrix(summaries);

  it("gives every area a cell for every contractor", () => {
    expect(roster.length).toBe(11);
    for (const area of areas) {
      expect(area.cells).toHaveLength(roster.length);
      expect(area.cells.map((c) => c.contractorId)).toEqual(
        roster.map((c) => c.contractorId),
      );
    }
  });

  it("scores section A from the section, not from a sub-section", () => {
    const a = areas.find((x) => x.code === "A")!;
    expect(a.avg).not.toBeNull();
    expect(a.contractors).toBeGreaterThan(0);
  });

  it("counts below-target contractors against the 90% target", () => {
    for (const area of areas) {
      const below = area.cells.filter(
        (c) => c.score !== null && c.score < TARGET_SCORE,
      ).length;
      expect(area.belowTarget).toBe(below);
      expect(area.belowTarget).toBeLessThanOrEqual(area.contractors);
    }
  });

  it("averages only the contractors that scored the area", () => {
    for (const area of areas) {
      const vals = area.cells
        .map((c) => c.score)
        .filter((v): v is number => v !== null);
      expect(area.contractors).toBe(vals.length);
      if (vals.length === 0) {
        expect(area.avg).toBeNull();
      } else {
        const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
        expect(area.avg).toBeCloseTo(mean, 1);
      }
    }
  });

  it("excludes drafts", () => {
    const draft = summaries.find((s) => s.status === "draft")!;
    const { contractors: roster2 } = checklistMatrix([draft]);
    expect(roster2).toHaveLength(0);
  });
});

describe("question statistics", () => {
  const stats = checklistQuestionStats(summaries, audits);

  it("covers every question", () => {
    expect(stats).toHaveLength(81);
  });

  it("ranks the most widely failed question first", () => {
    const rates = stats.map((s) => s.failRate);
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
    expect(rates[0]).toBeGreaterThan(0);
  });

  it("counts contractors rather than answers", () => {
    // One contractor failing four quarters running is one contractor with a
    // problem, not four — otherwise one stubborn company reads as systemic.
    for (const s of stats) {
      expect(s.failing).toBeLessThanOrEqual(s.contractors);
      expect(s.contractors).toBeLessThanOrEqual(11);
      expect(s.failRate).toBe(
        s.contractors === 0 ? 0 : s.failing / s.contractors,
      );
      expect(s.failRate).toBeLessThanOrEqual(1);
    }
  });

  it("never counts an N/A answer as a failure or as answering", () => {
    for (const s of stats) {
      expect(s.noCount + s.partialCount).toBeGreaterThanOrEqual(s.failing);
    }
  });

  it("filters to one area, and the areas partition the checklist", () => {
    const areas = checklistAreas();
    let total = 0;
    for (const area of areas) {
      const rows = checklistQuestionStats(summaries, audits, area.code);
      expect(rows).toHaveLength(area.questionCount);
      for (const r of rows) expect(r.areaCode).toBe(area.code);
      total += rows.length;
    }
    expect(total).toBe(81);
  });
});

describe("one question across contractors", () => {
  it("reports each contractor's latest review once, worst answer first", () => {
    const code = checklistQuestionStats(summaries, audits)[0]!.code;
    const rows = questionByContractor(code, summaries, audits);

    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r.contractorId)).size).toBe(rows.length);

    const rank = { no: 0, partial: 1, full: 2, na: 3 } as const;
    const order = rows.map((r) => rank[r.answer]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("returns nothing for a question code that does not exist", () => {
    expect(questionByContractor("ZZ9", summaries, audits)).toEqual([]);
  });
});
