import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { audits, contractors } from "./recorded";
import { recordedObservations } from "./recorded-observations";
import { ISSUE_BY_CODE, isGapCode } from "./issues";
import { findNames } from "./names";

/**
 * The observation log (Task 5): every written observation in the audit
 * workbooks, names removed, joined to the audit it was made in.
 *
 * The raw file in data/ is the source of truth for what SHOULD be here; these
 * tests read it with fs (it is deliberately outside src/ and never bundled)
 * so a row the build dropped by mistake fails by count, not by eye.
 */
const Q3_REVIEW = "af272-2026-Q3";

interface RawObservation {
  id: string;
  quarter: string;
  project: string;
  kind: string;
  questionCode: string | null;
  reference?: boolean;
}
const raw = JSON.parse(
  readFileSync(new URL("../../../data/observations-2025Q4-2026Q3.json", import.meta.url), "utf8"),
).observations as RawObservation[];
const record = JSON.parse(
  readFileSync(new URL("../../../data/hs-audits-2026Q3.json", import.meta.url), "utf8"),
);

/** The block build-recorded-dataset.py drops: PPCO's row pasted under SIBS. */
const isDuplicateBlock = (o: RawObservation) =>
  o.quarter === "2025-Q4" && o.project === "SIBS 838";

/** Audit id of a raw observation, derived independently of the build script:
 * the last run of digits in the project string is the work order's tail. */
function auditIdOf(o: RawObservation): string {
  const tail = o.project.match(/\d{3,}/g)?.at(-1)?.slice(-3) ?? "D&B";
  const c = contractors.find((x) => x.code === tail)!;
  return `${c.id}-${o.quarter}`;
}

describe("the recorded observations", () => {
  it("emits exactly the non-reference observations of the audits kept", () => {
    // 1557 in the data file = 1398 here + 90 in the dropped SIBS 838 block
    // + 69 reference rows elsewhere (R13). Pinned to what the build prints so
    // a dropped row fails here, not only when the raw file is at hand.
    expect(recordedObservations).toHaveLength(1398);
    const count = (k: string) => recordedObservations.filter((o) => o.kind === k).length;
    expect(count("gap")).toBe(781);
    expect(count("positive")).toBe(434);
    expect(count("site")).toBe(183);
    expect(raw).toHaveLength(1557);
    expect(raw.filter(isDuplicateBlock)).toHaveLength(90);
    expect(raw.filter((o) => o.reference && !isDuplicateBlock(o))).toHaveLength(69);
  });

  it("joins every observation to an audit that exists", () => {
    const ids = new Set(audits.map((a) => a.id));
    for (const o of recordedObservations) expect(ids.has(o.auditId)).toBe(true);
  });

  it("has one unique id per observation, in the audit-and-number form", () => {
    expect(new Set(recordedObservations.map((o) => o.id)).size).toBe(recordedObservations.length);
    for (const o of recordedObservations) expect(o.id).toMatch(new RegExp(`^${o.auditId}:\\d{3}$`));
  });

  it("holds, per audit, the data file's observations minus duplicates and references", () => {
    const expected = new Map<string, number>();
    for (const o of raw) {
      if (isDuplicateBlock(o) || o.reference) continue;
      const id = auditIdOf(o);
      expected.set(id, (expected.get(id) ?? 0) + 1);
    }
    const actual = new Map<string, number>();
    for (const o of recordedObservations) actual.set(o.auditId, (actual.get(o.auditId) ?? 0) + 1);
    expect(Object.fromEntries(actual)).toEqual(Object.fromEntries(expected));
    expect(actual.size).toBe(20);
  });

  it("names nobody: the post-load name scan finds nothing", () => {
    for (const o of recordedObservations) expect(findNames(o.text)).toEqual([]);
  });

  it("carries no work order in full: no run of nine or more digits survives", () => {
    for (const o of recordedObservations) expect(o.text).not.toMatch(/\d{9,}/);
  });

  it("keeps causes to the seven codes, and positives to GOOD alone", () => {
    for (const o of recordedObservations) {
      expect(o.causesSource).toBe("claude");
      for (const c of o.causes) expect(ISSUE_BY_CODE[c]).toBeDefined();
      if (o.kind === "positive") expect(o.causes).toEqual(["GOOD"]);
      else {
        expect(o.causes.length).toBeGreaterThanOrEqual(1);
        expect(o.causes.every(isGapCode)).toBe(true);
      }
    }
  });

  it("keeps the data file's order within each audit", () => {
    const seen = new Map<string, string>();
    for (const o of recordedObservations) {
      const n = o.id.slice(-3);
      expect(n > (seen.get(o.auditId) ?? "")).toBe(true);
      seen.set(o.auditId, n);
    }
  });
});

describe("the Q3 2026 review's causes", () => {
  const q3 = audits.find((a) => a.id === Q3_REVIEW)!;
  const own = (code: string) =>
    [
      ...new Set(
        recordedObservations
          .filter((o) => o.auditId === Q3_REVIEW && o.questionCode === code && o.kind !== "positive")
          .flatMap((o) => o.causes),
      ),
    ];

  it("gives every Partial and No answer at least one gap cause", () => {
    for (const [code, r] of Object.entries(q3.responses)) {
      if (r.answer === "partial" || r.answer === "no") {
        expect(r.issues.length, code).toBeGreaterThanOrEqual(1);
        expect(r.issues.every(isGapCode), code).toBe(true);
      }
    }
  });

  it("uses a question's own observations when it has them", () => {
    for (const code of ["A1", "A9", "B2.3", "B6.4", "C2.15"]) {
      expect(q3.responses[code]!.issues).toEqual(own(code));
    }
  });

  it("resolves the four 'Addressed in …' questions through the pointers (R16, R18)", () => {
    // Review sheet H161/H170/H171/H172: A3 -> B7.1, A12 -> A9, A13 -> B6, A14 -> A4.
    expect(q3.responses["A3"]!.issues).toEqual(own("B7.1"));
    expect(q3.responses["A12"]!.issues).toEqual(own("A9"));
    expect(q3.responses["A14"]!.issues).toEqual(own("A4"));
    // B6 is an area: the first three of its questions' causes, in order.
    const b6 = [...new Set(["B6.1", "B6.2", "B6.3", "B6.4", "B6.5", "B6.6", "B6.7", "B6.8", "B6.9"].flatMap(own))];
    expect(q3.responses["A13"]!.issues).toEqual(b6.slice(0, 3));
    expect(q3.responses["A13"]!.issues.length).toBeLessThanOrEqual(3);
    for (const code of ["A3", "A12", "A13", "A14"]) {
      expect(q3.responses[code]!.issues.length, code).toBeGreaterThanOrEqual(1);
    }
  });

  it("marks Full answers GOOD only where a positive observation backs them, and N/A none", () => {
    for (const [code, r] of Object.entries(q3.responses)) {
      const positive = recordedObservations.some(
        (o) => o.auditId === Q3_REVIEW && o.questionCode === code && o.kind === "positive",
      );
      if (r.answer === "full") expect(r.issues, code).toEqual(positive ? ["GOOD"] : []);
      if (r.answer === "na") expect(r.issues, code).toEqual([]);
    }
  });

  it("sits beside an unchanged answer set", () => {
    expect(Object.keys(q3.responses)).toHaveLength(81);
    expect(Object.keys(record.audits[0].answers)).toHaveLength(81);
    for (const [code, r] of Object.entries(q3.responses)) {
      expect(r.answer, code).toBe(record.audits[0].answers[code]);
    }
  });
});

describe("how the log reaches the app", () => {
  it("is not statically imported anywhere in src/ except by tests (R17)", () => {
    // Task 6 loads it with import(); a static import would put ~1,400
    // observations in every page's bundle.
    const root = new URL("../..", import.meta.url).pathname;
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")) {
          const src = readFileSync(full, "utf8");
          if (/(?:from|import)\s+["'][^"']*recorded-observations["']/.test(src)) {
            offenders.push(full.slice(root.length));
          }
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });

  it("imports only types, so it stays a standalone module", () => {
    const src = readFileSync(new URL("./recorded-observations.ts", import.meta.url), "utf8");
    const imports = src.match(/^import .*$/gm) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const line of imports) expect(line).toMatch(/^import type /);
  });
});
