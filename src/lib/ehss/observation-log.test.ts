import { describe, expect, it } from "vitest";
import {
  causeCounts,
  filterLog,
  logFilterToParams,
  parseLogFilter,
  toLogRows,
  type LogRow,
} from "./observation-log";
import type { RecordedObservation } from "./model";
import type { AuditSummary } from "./summaries";
import type { IssueCode } from "./issues";

const summary = (id: string, over: Partial<AuditSummary>): AuditSummary =>
  ({
    id,
    quarter: "2026-Q1",
    contractorId: "c-abya",
    contractorCode: "112",
    contractorName: "ABYA",
    subRegionId: "sr-1",
    ...over,
  }) as AuditSummary;

const summaries = [
  summary("a1", {}),
  summary("a2", {
    quarter: "2025-Q4",
    contractorId: "c-af",
    contractorCode: "272",
    contractorName: "AF",
    subRegionId: "sr-2",
  }),
];

const obs = (
  id: string,
  auditId: string,
  kind: RecordedObservation["kind"],
  questionCode: string | null,
  text: string,
  causes: IssueCode[],
): RecordedObservation => ({ id, auditId, kind, questionCode, text, causes, causesSource: "claude" });

const observations: RecordedObservation[] = [
  obs("1", "a1", "gap", "B6.3", "Work permit (PTW) was not displayed", ["DOC", "IMP"]),
  obs("2", "a1", "gap", "A2", "Plan a+b is missing", ["PLN"]),
  obs("3", "a2", "positive", null, "Good housekeeping at the permit box", ["GOOD"]),
  obs("4", "a2", "site", "C1.4", "Scaffold tag missing", []),
  obs("5", "a2", "gap", "B6.1", "Subcontractor assessment not on file", []),
  obs("6", "orphan", "gap", "A1", "No audit behind this", ["DOC"]),
];

const rows = toLogRows(observations, summaries);
const ids = (r: LogRow[]) => r.map((x) => x.id);

describe("toLogRows", () => {
  it("joins the audit's quarter, contractor and sub-region, and derives the area", () => {
    expect(rows[0]).toMatchObject({
      quarter: "2026-Q1",
      contractorId: "c-abya",
      contractorName: "ABYA (112)",
      subRegionId: "sr-1",
      area: "B6",
    });
    expect(rows[1]!.area).toBe("A");
    expect(rows[2]!.area).toBeNull();
    expect(rows[3]!.area).toBe("C1");
  });

  it("drops observations whose audit has no summary", () => {
    expect(ids(rows)).toEqual(["1", "2", "3", "4", "5"]);
  });
});

describe("filterLog search", () => {
  it("searches literally", () => {
    expect(() => filterLog(rows, { q: "permit (PTW)" })).not.toThrow();
    expect(ids(filterLog(rows, { q: "permit (PTW)" }))).toEqual(["1"]);
    expect(ids(filterLog(rows, { q: "p.rmit" }))).toEqual([]); // "." is not a wildcard
    expect(ids(filterLog(rows, { q: "(PTW)" }))).toEqual(["1"]);
    expect(ids(filterLog(rows, { q: "a+b" }))).toEqual(["2"]);
    expect(ids(filterLog(rows, { q: "  B6 " }))).toEqual(["1", "5"]);
  });

  it("matches text, question code and contractor name, case-insensitively", () => {
    expect(ids(filterLog(rows, { q: "SCAFFOLD" }))).toEqual(["4"]);
    expect(ids(filterLog(rows, { q: "b6.3" }))).toEqual(["1"]);
    expect(ids(filterLog(rows, { q: "abya" }))).toEqual(["1", "2"]);
    expect(ids(filterLog(rows, { q: "112" }))).toEqual(["1", "2"]);
  });

  it("requires all terms to match", () => {
    expect(ids(filterLog(rows, { q: "permit abya" }))).toEqual(["1"]);
    expect(ids(filterLog(rows, { q: "permit scaffold" }))).toEqual([]);
  });

  it("returns every row for an empty query, in input order", () => {
    expect(ids(filterLog(rows, { q: "   " }))).toEqual(["1", "2", "3", "4", "5"]);
  });
});

describe("filterLog filters", () => {
  it("narrows by quarter, sub-region, contractor, area, cause and kind", () => {
    expect(ids(filterLog(rows, { q: "", quarter: "2025-Q4" }))).toEqual(["3", "4", "5"]);
    expect(ids(filterLog(rows, { q: "", subRegionId: "sr-1" }))).toEqual(["1", "2"]);
    expect(ids(filterLog(rows, { q: "", contractorId: "c-af" }))).toEqual(["3", "4", "5"]);
    expect(ids(filterLog(rows, { q: "", area: "B6" }))).toEqual(["1", "5"]);
    expect(ids(filterLog(rows, { q: "", cause: "IMP" }))).toEqual(["1"]);
    expect(ids(filterLog(rows, { q: "", kind: "positive" }))).toEqual(["3"]);
  });

  it("combines filters with search", () => {
    expect(ids(filterLog(rows, { q: "missing", contractorId: "c-af", kind: "site" }))).toEqual(["4"]);
  });

  it("matches nothing for an unknown id", () => {
    expect(filterLog(rows, { q: "", contractorId: "nope" })).toEqual([]);
  });

  it("needsCause returns only gap and site rows with no gap cause", () => {
    expect(ids(filterLog(rows, { q: "", needsCause: true }))).toEqual(["4", "5"]);
  });
});

describe("causeCounts", () => {
  it("keeps the seven gap causes in fixed order with zeros, counting each row once per cause", () => {
    expect(causeCounts(rows)).toEqual([
      { code: "DOC", count: 1 },
      { code: "PLN", count: 1 },
      { code: "IMP", count: 1 },
      { code: "CMP", count: 0 },
      { code: "SUP", count: 0 },
      { code: "RES", count: 0 },
      { code: "LED", count: 0 },
    ]);
  });

  it("returns seven zeros for no rows", () => {
    const c = causeCounts([]);
    expect(c).toHaveLength(7);
    expect(c.every((x) => x.count === 0)).toBe(true);
  });
});

describe("filter <-> URL", () => {
  it("round-trips", () => {
    const f = {
      q: "permit  box",
      quarter: "2026-Q1",
      subRegionId: "sr-1",
      contractorId: "c-abya",
      area: "B6",
      cause: "DOC" as const,
      kind: "gap" as const,
      needsCause: true,
    };
    expect(parseLogFilter(logFilterToParams(f))).toEqual(f);
  });

  it("gives empty params for an empty filter", () => {
    expect(logFilterToParams({ q: "" }).toString()).toBe("");
    expect(parseLogFilter(new URLSearchParams())).toEqual({ q: "" });
  });

  it("leaves a whitespace-only search out of the URL", () => {
    expect(logFilterToParams({ q: "  " }).toString()).toBe("");
    expect(logFilterToParams({ q: " a " }).get("q")).toBe(" a ");
  });

  it("ignores unknown filter values", () => {
    expect(
      parseLogFilter(new URLSearchParams("?cause=XYZ&quarter=1999-Q9&kind=foo&area=Z9&needsCause=0&x=1&contractorId=")),
    ).toEqual({ q: "" });
    expect(parseLogFilter(new URLSearchParams("?cause=GOOD"))).toEqual({ q: "" });
  });
});
