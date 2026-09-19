import { describe, expect, it } from "vitest";
import {
  CRITICAL_RISKS,
  CRITICAL_RISK_BY_ID,
  crcScore,
  scopedRisks,
} from "./critical-risks";
import { audits, contractors, subRegions } from "./mock";
import { summarizeAll, criticalRiskStats, weakestCriticalRisks } from "./summaries";
import { DOMAIN_BY_ID } from "./domains";

describe("critical risk register", () => {
  it("holds the client's fourteen hazards in register order", () => {
    expect(CRITICAL_RISKS.map((r) => r.label)).toEqual([
      "Breaking Ground & Excavation",
      "Confined Spaces",
      "Energized System",
      "Explosives & Blasting",
      "Fire",
      "Hot Work",
      "Lifting",
      "Mobile Plant & Equipment",
      "Temporary Works",
      "Driving",
      "Working at Height",
      "Working in Heat",
      "Working on or Near Live Roads",
      "Working on or Near Water",
    ]);
  });

  it("tags every hazard with a real SHEW pillar", () => {
    for (const risk of CRITICAL_RISKS) {
      expect(DOMAIN_BY_ID[risk.domain]).toBeDefined();
    }
    // Heat stress is occupational health, not physical safety.
    expect(CRITICAL_RISK_BY_ID.heat.domain).toBe("health");
    expect(CRITICAL_RISK_BY_ID.lifting.domain).toBe("safety");
  });
});

describe("crcScore", () => {
  it("averages the hazards in scope", () => {
    expect(crcScore({ lifting: 80, height: 90, driving: 100 })).toBe(90);
  });

  it("excludes out-of-scope hazards rather than scoring them zero", () => {
    // Two hazards in scope averaging 85; the other twelve must not drag it down.
    expect(crcScore({ lifting: 80, height: 90 })).toBe(85);
  });

  it("returns null (not 0) when no hazard is in scope", () => {
    expect(crcScore({})).toBeNull();
  });

  it("lists scoped hazards in register order", () => {
    expect(scopedRisks({ height: 90, ground: 80 }).map((r) => r.id)).toEqual([
      "ground",
      "height",
    ]);
  });
});

describe("CRC in the demo dataset", () => {
  const summaries = summarizeAll(audits, contractors, subRegions);
  const finalizedSummaries = summaries.filter((s) => s.status !== "draft");

  it("scopes every finalized review to at least one hazard", () => {
    for (const s of finalizedSummaries) {
      expect(scopedRisks(s.criticalRisks).length).toBeGreaterThan(0);
    }
  });

  it("keeps a contractor's hazard scope stable across its quarters", () => {
    const byContractor = new Map<string, Set<string>>();
    for (const s of finalizedSummaries) {
      const scope = scopedRisks(s.criticalRisks).map((r) => r.id).join(",");
      const seen = byContractor.get(s.contractorId) ?? new Set();
      seen.add(scope);
      byContractor.set(s.contractorId, seen);
    }
    for (const [, scopes] of byContractor) expect(scopes.size).toBe(1);
  });

  it("derives a CRC score that matches the recorded scorecard figure", () => {
    for (const s of finalizedSummaries) {
      const derived = crcScore(s.criticalRisks);
      expect(derived).not.toBeNull();
      // The hazard breakdown is a decomposition of the recorded figure, so
      // it must reproduce it to within rounding of a single hazard.
      expect(Math.abs(derived! - s.disciplineScores.crc!)).toBeLessThan(1);
    }
  });

  it("never scores a hazard outside the contractor's scope", () => {
    for (const s of finalizedSummaries) {
      for (const [id, value] of Object.entries(s.criticalRisks)) {
        expect(CRITICAL_RISK_BY_ID[id as keyof typeof CRITICAL_RISK_BY_ID]).toBeDefined();
        expect(value).toBeGreaterThan(0);
      }
    }
  });
});

describe("criticalRiskStats", () => {
  const summaries = summarizeAll(audits, contractors, subRegions);
  const stats = criticalRiskStats(summaries);

  it("drops hazards no contractor carries and keeps the rest in register order", () => {
    const order = CRITICAL_RISKS.map((r) => r.id);
    const positions = stats.map((s) => order.indexOf(s.id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    for (const s of stats) expect(s.reviews).toBeGreaterThan(0);
  });

  it("counts distinct contractors, not reviews", () => {
    for (const s of stats) {
      expect(s.contractors).toBeLessThanOrEqual(s.reviews);
      expect(s.belowTarget.length).toBeLessThanOrEqual(s.contractors);
    }
  });

  it("excludes drafts", () => {
    const draft = summaries.find((s) => s.status === "draft");
    expect(draft).toBeDefined();
    expect(scopedRisks(draft!.criticalRisks)).toHaveLength(0);
  });

  it("names below-target contractors worst first", () => {
    for (const s of stats) {
      const scores = s.belowTarget.map((c) => c.score);
      expect(scores).toEqual([...scores].sort((a, b) => a - b));
      for (const score of scores) expect(score).toBeLessThan(90);
    }
  });

  it("ranks the weakest hazards lowest-average first", () => {
    const weakest = weakestCriticalRisks(summaries, 5);
    expect(weakest.length).toBeGreaterThan(0);
    expect(weakest.length).toBeLessThanOrEqual(5);
    const avgs = weakest.map((r) => r.avg!);
    expect(avgs).toEqual([...avgs].sort((a, b) => a - b));
  });
});
