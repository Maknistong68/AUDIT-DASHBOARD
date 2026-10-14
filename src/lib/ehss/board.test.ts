import { describe, expect, it } from "vitest";
import { audits, contractors, subRegions } from "./recorded";
import {
  boardBySubRegion,
  latestQuarter,
  programmeKpis,
  quartersOnRecord,
  sectionStanding,
  stickyAreas,
  summarizeAll,
} from "./summaries";
import { TARGET_SCORE } from "./disciplines";

const all = summarizeAll(audits, contractors, subRegions);
const latest = latestQuarter(all);

describe("the board", () => {
  it("opens on the most recent quarter", () => {
    expect(latest).toBe("2026-Q1");
    expect(quartersOnRecord(all)).toEqual(["2026-Q1", "2025-Q4"]);
  });

  it("splits by sub-region, so each director sees their own patch", () => {
    const panels = boardBySubRegion(all, latest, subRegions);
    expect(panels.map((p) => p.subRegionId)).toEqual(["sr1", "sr2"]);
    const total = panels.reduce((n, p) => n + p.rows.length, 0);
    expect(total).toBe(all.filter((s) => s.quarter === latest).length);
    // Every contractor lands in exactly one panel.
    const ids = panels.flatMap((p) => p.rows.map((r) => r.contractorId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts the worst first — the answer is the top of the list", () => {
    for (const panel of boardBySubRegion(all, latest, subRegions)) {
      const scores = panel.rows.map((r) => r.score ?? 101);
      expect([...scores].sort((a, b) => a - b)).toEqual(scores);
    }
  });

  it("carries the move since the contractor's own previous review", () => {
    const panels = boardBySubRegion(all, latest, subRegions);
    const rows = panels.flatMap((p) => p.rows);
    const ech = rows.find((r) => r.code === "131")!;
    // ECH: 77.15 in Q4 2025, 74.44 in Q1 2026.
    expect(ech.score).toBe(74.44);
    expect(ech.delta).toBe(-2.71);
    // A contractor with only one review has no delta rather than a zero.
    const nbc = rows.find((r) => r.code === "026")!;
    expect(nbc.delta).toBeNull();
  });

  it("counts the areas below target per contractor", () => {
    const rows = boardBySubRegion(all, latest, subRegions).flatMap((p) => p.rows);
    for (const r of rows) {
      expect(r.areasBelow).toBeLessThanOrEqual(r.areasScored);
      expect(r.areasScored).toBeGreaterThan(0);
    }
    const rpco = rows.find((r) => r.code === "440")!;
    expect(rpco.score).toBe(45.76);
    expect(rpco.areasBelow).toBeGreaterThan(0);
  });
});

describe("the programme headline", () => {
  const kpi = programmeKpis(all, latest);

  it("averages the quarter's reviews", () => {
    const q1 = all.filter((s) => s.quarter === "2026-Q1" && s.total !== null);
    const mean =
      q1.reduce((sum, s) => sum + s.total!, 0) / q1.length;
    expect(kpi.average).toBeCloseTo(mean, 2);
    expect(kpi.contractors).toBe(q1.length);
  });

  it("measures movement only over contractors present in both quarters", () => {
    // Four contractors are new in Q1 2026; counting them as movement would
    // make the programme look like it moved when only its membership did.
    const q4 = new Set(
      all.filter((s) => s.quarter === "2025-Q4").map((s) => s.contractorId),
    );
    const both = all.filter(
      (s) => s.quarter === "2026-Q1" && q4.has(s.contractorId),
    );
    expect(both.length).toBeLessThan(kpi.contractors);
    expect(kpi.delta).not.toBeNull();
  });

  it("names the weakest area, which is subcontractor management", () => {
    expect(kpi.weakestArea?.code).toBe("B6");
    expect(kpi.weakestArea!.score).toBeLessThan(TARGET_SCORE);
  });

  it("counts every contractor below target", () => {
    expect(kpi.belowTarget).toBe(kpi.contractors);
  });
});

describe("whether a gap is sticking", () => {
  const areas = stickyAreas(all);

  it("covers all 15 checklist areas", () => {
    expect(areas).toHaveLength(15);
  });

  it("calls an area recurring when it was weak last audit and is weak again", () => {
    // The owner's definition. With two quarters on record this is the only
    // grain the recorded data supports, and it has two real numbers behind it.
    for (const a of areas) {
      if (a.recurring) {
        expect(a.score).toBeLessThan(TARGET_SCORE);
        expect(a.previous).not.toBeNull();
        expect(a.previous!).toBeLessThan(TARGET_SCORE);
      }
      // The three states are exclusive and exhaustive.
      expect([a.recurring, a.isNew, a.met].filter(Boolean)).toHaveLength(1);
    }
    expect(areas.filter((a) => a.recurring).length).toBeGreaterThan(0);
  });

  it("finds B6 recurring — weak in both quarters", () => {
    const b6 = areas.find((a) => a.code === "B6")!;
    expect(b6.recurring).toBe(true);
    expect(b6.score).toBeLessThan(30);
  });
});

describe("where the gap is — section A, B or C", () => {
  it("returns the three sections for one contractor", () => {
    const ech = all.filter((s) => s.contractorId === "ech131");
    const sections = sectionStanding(ech);
    expect(sections.map((s) => s.code)).toEqual(["A", "B", "C"]);
    for (const s of sections) {
      expect(s.score).toBeGreaterThan(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });
});
