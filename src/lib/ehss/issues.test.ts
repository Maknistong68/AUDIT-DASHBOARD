import { describe, expect, it } from "vitest";
import {
  GAP_CATEGORIES,
  ISSUE_BY_CODE,
  ISSUE_CATEGORIES,
  isGapCode,
  readIssues,
} from "./issues";
import { audits, contractors, subRegions } from "./fixture";
import { collectObservations, issueBreakdown, summarizeAll } from "./summaries";

describe("the taxonomy", () => {
  it("has twelve gap categories and one positive", () => {
    expect(GAP_CATEGORIES).toHaveLength(12);
    expect(ISSUE_CATEGORIES.filter((c) => !c.gap).map((c) => c.code)).toEqual([
      "GOOD",
    ]);
  });

  it("gives every category a code, a plain-English line and an owner", () => {
    for (const c of ISSUE_CATEGORIES) {
      expect(c.code).toMatch(/^[A-Z]{3,4}$/);
      expect(c.label.length).toBeGreaterThan(2);
      expect(c.description.endsWith(".")).toBe(true);
      expect(c.owner.length).toBeGreaterThan(0);
      expect(ISSUE_BY_CODE[c.code]).toBe(c);
    }
  });

  it("has no duplicate codes or labels", () => {
    expect(new Set(ISSUE_CATEGORIES.map((c) => c.code)).size).toBe(
      ISSUE_CATEGORIES.length,
    );
    expect(new Set(ISSUE_CATEGORIES.map((c) => c.label)).size).toBe(
      ISSUE_CATEGORIES.length,
    );
  });

  it("is discipline-agnostic — nothing names one audit", () => {
    // The same twelve serve H&S, Critical Risk, Environment, Security and
    // Worker Welfare, so a category that named one would not travel.
    const parochial = /health & safety|welfare|security|environment|critical risk/i;
    for (const c of ISSUE_CATEGORIES) {
      expect(parochial.test(c.label), c.code).toBe(false);
    }
  });

  it("knows which codes are gaps", () => {
    expect(isGapCode("DOC")).toBe(true);
    expect(isGapCode("GOOD")).toBe(false);
  });
});

describe("reading stored categories", () => {
  it("keeps a valid array and drops anything unrecognised", () => {
    expect(readIssues(["DOC", "nope", "SUB"])).toEqual(["DOC", "SUB"]);
    expect(readIssues([])).toEqual([]);
  });

  it("upgrades the superseded single OB code", () => {
    expect(readIssues("OB1")).toEqual(["GOOD"]);
    expect(readIssues("OB2")).toEqual(["DOC"]);
    expect(readIssues("OB3")).toEqual(["IMP"]);
    // OB4 and OB5 each bundled several causes; they map to the closest one
    // rather than being expanded into guesses the auditor never made.
    expect(readIssues("OB4")).toEqual(["TRN"]);
    expect(readIssues("OB5")).toEqual(["INS"]);
  });

  it("treats anything else as no categories", () => {
    expect(readIssues(null)).toEqual([]);
    expect(readIssues(undefined)).toEqual([]);
    expect(readIssues("OB9")).toEqual([]);
    expect(readIssues(42)).toEqual([]);
  });
});

describe("categories in the dataset", () => {
  const rows = collectObservations(audits, contractors);

  it("gives every gap at least one category", () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.issues.length).toBeGreaterThan(0);
  });

  it("records more than one on a meaningful share of findings", () => {
    const multi = rows.filter((r) => r.issues.length > 1).length;
    expect(multi / rows.length).toBeGreaterThan(0.3);
  });

  it("never puts the positive category on a gap", () => {
    for (const r of rows) expect(r.issues).not.toContain("GOOD");
  });

  it("keeps categories in register order so records are comparable", () => {
    const order = GAP_CATEGORIES.map((c) => c.code);
    for (const r of rows) {
      const positions = r.issues.map((c) => order.indexOf(c));
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });

  it("exercises every category somewhere in the programme", () => {
    const used = new Set(issueBreakdown(rows).map((b) => b.code));
    for (const c of GAP_CATEGORIES) expect(used.has(c.code), c.code).toBe(true);
  });

  it("leaves the scorecard untouched — categories do not score", () => {
    const summaries = summarizeAll(audits, contractors, subRegions);
    const workbook = summaries.find((s) => s.id === "afh1272-2026-Q3")!;
    expect(workbook.total).toBe(60.85);
  });
});
