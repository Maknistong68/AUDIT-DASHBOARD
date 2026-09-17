import { describe, expect, it } from "vitest";
import { audits, contractorLabel, contractors, subRegions } from "./mock";
import { weightedOverall } from "./disciplines";
import {
  areaTrends,
  collectObservations,
  contractorStats,
  finalized,
  focusAreas,
  observationBreakdown,
  strengthAreas,
  summarizeAll,
  topIssues,
  windowByContractor,
} from "./summaries";

const all = summarizeAll(audits, contractors, subRegions);
const latestQuarter = "2026-Q3";

describe("contractor register", () => {
  it("holds the scorecard's eleven contractors across two sub-regions", () => {
    expect(subRegions.map((s) => s.name)).toEqual([
      "Sub Region 1",
      "Sub Region 2",
    ]);
    expect(contractors).toHaveLength(11);
    expect(contractors.filter((c) => c.subRegionId === "sr1")).toHaveLength(7);
    expect(contractors.filter((c) => c.subRegionId === "sr2")).toHaveLength(4);
  });

  it("labels contractors with their project number", () => {
    const alFahd = contractors.filter((c) => c.name === "Al Fahd");
    expect(alFahd).toHaveLength(3); // three separate Al Fahd projects
    expect(alFahd.map(contractorLabel).sort()).toEqual([
      "Al Fahd (0882)",
      "Al Fahd (1272)",
      "Al Fahd (823)",
    ]);
  });
});

describe("quarterly reviews", () => {
  it("covers four quarters per contractor", () => {
    expect(new Set(audits.map((a) => a.quarter)).size).toBe(4);
    expect(audits).toHaveLength(contractors.length * 4);
  });

  it("carries one open draft for the current quarter", () => {
    const drafts = audits.filter((a) => a.status === "draft");
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.quarter).toBe(latestQuarter);
    expect(finalized(all).some((s) => s.status === "draft")).toBe(false);
  });

  it("reproduces the scorecard's overall scores for the latest quarter", () => {
    const expected: Record<string, number> = {
      ppco: 80.5, afh882: 80.1, sibs: 76.25, abya: 75.45,
      rpco: 78.5, thys: 84.05, sarco: 86.55, afh823: 81.6, ech: 90.75,
    };
    for (const [id, want] of Object.entries(expected)) {
      const row = all.find(
        (s) => s.contractorId === id && s.quarter === latestQuarter,
      )!;
      expect(row.overall, id).toBeCloseTo(want, 2);
    }
  });

  it("scores Al Fahd (1272) from the workbook checklist, not a recorded value", () => {
    const row = all.find(
      (s) => s.contractorId === "afh1272" && s.quarter === latestQuarter,
    )!;
    expect(row.total).toBe(60.85); // the 81-question checklist total
    expect(row.disciplineScores.hs).toBe(60.85);
    expect(row.overall).toBeCloseTo(
      weightedOverall({ ...row.disciplineScores })!,
      5,
    );
  });
});

describe("timeframe windows", () => {
  it("'latest' keeps exactly one review per contractor", () => {
    for (const list of windowByContractor(all, "latest").values()) {
      expect(list).toHaveLength(1);
    }
  });

  it("'last3' keeps the three most recent, oldest first", () => {
    const list = windowByContractor(all, "last3").get("ppco")!;
    expect(list.map((a) => a.quarter)).toEqual([
      "2026-Q1",
      "2026-Q2",
      "2026-Q3",
    ]);
  });

  it("'last4' is a year of quarterly reviews", () => {
    expect(windowByContractor(all, "last4").get("ppco")!).toHaveLength(4);
  });

  it("never returns more reviews than exist — TDP's latest is a draft", () => {
    expect(windowByContractor(all, "all").get("tdp")!).toHaveLength(3);
  });
});

describe("contractor stats", () => {
  it("ranks by average score, best first", () => {
    const scores = contractorStats(all, "latest").map((s) => s.avgScore!);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("uses the weighted scorecard figure, not the H&S checklist total", () => {
    const stats = contractorStats(all, "latest").find(
      (s) => s.contractorId === "ech",
    )!;
    const row = all.find(
      (s) => s.contractorId === "ech" && s.quarter === latestQuarter,
    )!;
    expect(stats.avgScore).toBe(row.overall);
    expect(stats.avgScore).not.toBe(row.total);
  });

  it("reports a rising trend for an improving contractor", () => {
    expect(
      contractorStats(all, "all").find((s) => s.contractorId === "abya")!.delta,
    ).toBeGreaterThan(0);
  });

  it("reports a falling trend for a slipping contractor", () => {
    expect(
      contractorStats(all, "all").find((s) => s.contractorId === "afh1272")!
        .delta,
    ).toBeLessThan(0);
  });

  it("breaks the score down by discipline", () => {
    const stats = contractorStats(all, "latest").find(
      (s) => s.contractorId === "ppco",
    )!;
    expect(stats.disciplineAverages.map((d) => d.id)).toEqual([
      "hs", "crc", "env", "sec", "ww",
    ]);
    expect(stats.disciplineAverages.find((d) => d.id === "hs")!.avg).toBe(76);
    expect(stats.disciplineAverages.find((d) => d.id === "sec")!.gap).toBe(1);
  });
});

describe("area trends — the executive brief's basis", () => {
  const forContractor = (id: string) =>
    areaTrends(all.filter((s) => s.contractorId === id));

  it("builds one score series per checklist area", () => {
    const trends = forContractor("ppco");
    expect(trends.length).toBeGreaterThan(10);
    for (const t of trends) {
      expect(t.scores).toHaveLength(t.reviews);
      expect(t.latest).toBe(t.scores[t.scores.length - 1]);
    }
  });

  it("classifies movement and treats small moves as flat", () => {
    const trends = forContractor("ppco");
    for (const t of trends) {
      if (t.change === null || Math.abs(t.change) < 3) {
        expect(t.direction).toBe("flat");
      } else {
        expect(t.direction).toBe(t.change > 0 ? "improving" : "declining");
      }
    }
  });

  it("averages per quarter when several contractors are in scope", () => {
    // Programme-wide: one point per quarter, not one per review.
    const programme = areaTrends(all);
    const quarters = new Set(finalized(all).map((s) => s.quarter)).size;
    for (const t of programme) expect(t.reviews).toBeLessThanOrEqual(quarters);
  });

  it("focus areas are below target and never improving", () => {
    const focus = focusAreas(forContractor("afh1272"), 5);
    expect(focus.length).toBeGreaterThan(0);
    for (const t of focus) {
      expect(t.latest).toBeLessThan(90);
      expect(t.direction).not.toBe("improving");
    }
    // Worst gap first.
    const gaps = focus.map((t) => t.gap!);
    expect([...gaps].sort((a, b) => b - a)).toEqual(gaps);
  });

  it("strengths are at target or improving", () => {
    for (const t of strengthAreas(forContractor("ech"), 4)) {
      expect(t.latest >= 90 || t.direction === "improving").toBe(true);
    }
  });
});

describe("findings", () => {
  it("ranks issues by weighted points lost", () => {
    const issues = topIssues(
      audits.filter((a) => a.id === "afh1272-2026-Q3"),
      5,
    );
    expect(issues).toHaveLength(5);
    const lost = issues.map((i) => i.lostPoints);
    expect([...lost].sort((a, b) => b - a)).toEqual(lost);
    for (const i of issues) {
      expect(i.lostPoints).toBeCloseTo(
        i.weight * i.noCount + i.weight * 0.5 * i.partialCount,
        5,
      );
    }
  });

  it("counts gap classifications across finalized reviews only", () => {
    const rows = collectObservations(audits, contractors);
    expect(rows.every((r) => r.observation !== "OB1")).toBe(true);
    const breakdown = observationBreakdown(rows);
    expect(breakdown.reduce((sum, b) => sum + b.count, 0)).toBe(rows.length);
  });
});
