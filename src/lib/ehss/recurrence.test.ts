import { describe, expect, it } from "vitest";
import {
  RECURRING_THRESHOLD,
  closedFindings,
  findingHistories,
  findingMovement,
  recurringFindings,
  summarizeAll,
} from "./summaries";
import { CHECKLIST } from "./checklist";
import { flattenChecklist } from "./scoring";
import { audits, contractors, subRegions } from "./fixture";
import type { EhssAnswer, EhssAudit, EhssContractor, SubRegion } from "./model";

const FLAT = flattenChecklist(CHECKLIST);
const Q = FLAT[0]!.question.code; // a real question code, so the join works

const sr: SubRegion[] = [{ id: "sr1", name: "Sub Region 1" }];
const co: EhssContractor[] = [
  { id: "c1", code: "001", name: "Contractor", subRegionId: "sr1", active: true },
];

/** One finalized review per answer, oldest first. */
function build(answers: EhssAnswer[]): EhssAudit[] {
  return answers.map((answer, i) => ({
    id: `a${i}`,
    contractorId: "c1",
    quarter: `2026-Q${i + 1}`,
    auditDate: `2026-0${i + 1}-01`,
    inspectionNo: `I${i}`,
    status: "approved" as const,
    responses: { [Q]: { answer, issues: answer === "full" ? [] : ["IMP"] } },
    disciplineScores: { hs: 70 },
    criticalRisks: {},
  }));
}

const historyFor = (answers: EhssAnswer[]) => {
  const list = build(answers);
  const rows = findingHistories(summarizeAll(list, co, sr), list);
  return rows.find((h) => h.questionCode === Q) ?? null;
};

describe("finding status", () => {
  it("ignores a question that was never a finding", () => {
    expect(historyFor(["full", "full", "full"])).toBeNull();
  });

  it("calls a single open answer open, not recurring", () => {
    const h = historyFor(["full", "full", "partial"])!;
    expect(h.status).toBe("open");
    expect(h.openStreak).toBe(1);
  });

  it(`calls ${RECURRING_THRESHOLD} consecutive open reviews recurring`, () => {
    const h = historyFor(["no", "partial", "partial"])!;
    expect(RECURRING_THRESHOLD).toBe(3);
    expect(h.status).toBe("recurring");
    expect(h.openStreak).toBe(3);
  });

  it("stops one short of the threshold", () => {
    const h = historyFor(["full", "partial", "partial"])!;
    expect(h.status).toBe("open");
    expect(h.openStreak).toBe(2);
  });

  it("calls a finding that closed and came back reopened", () => {
    const h = historyFor(["no", "full", "partial"])!;
    expect(h.status).toBe("reopened");
    expect(h.reopened).toBe(true);
    // Reopened outranks a plain long streak: it means the fix did not hold.
    expect(h.openStreak).toBe(1);
  });

  it("prefers reopened over recurring when both apply", () => {
    const h = historyFor(["no", "full", "no", "no", "no"])!;
    expect(h.openStreak).toBe(3);
    expect(h.status).toBe("reopened");
  });

  it("closes a finding only on a Full answer in the latest review", () => {
    const h = historyFor(["no", "partial", "full"])!;
    expect(h.status).toBe("closed");
    expect(h.closedIn).toBe("2026-Q3");
  });
});

describe("N/A is not a closure", () => {
  // The decision this whole module turns on: "not applicable this quarter"
  // usually means the work was not running, which is not evidence that
  // anything was fixed.
  it("does not close a finding", () => {
    const h = historyFor(["no", "partial", "na"])!;
    expect(h.status).not.toBe("closed");
    expect(h.closedIn).toBeNull();
  });

  it("keeps the finding open rather than dropping it", () => {
    expect(historyFor(["no", "na"])!.status).toBe("open");
  });

  it("breaks the open streak rather than extending it", () => {
    const h = historyFor(["no", "no", "na", "no"])!;
    expect(h.openStreak).toBe(1);
    expect(h.status).toBe("open");
  });

  it("does not make a later Full count as a reopening", () => {
    const h = historyFor(["no", "na", "full"])!;
    expect(h.status).toBe("closed");
  });
});

describe("trajectory of an open finding", () => {
  it("reads No -> Partial as improving", () => {
    expect(historyFor(["no", "no", "partial"])!.trajectory).toBe("improving");
  });

  it("reads Partial -> No as worsening", () => {
    expect(historyFor(["partial", "partial", "no"])!.trajectory).toBe("worsening");
  });

  it("reads an unchanged run as same", () => {
    expect(historyFor(["partial", "partial", "partial"])!.trajectory).toBe("same");
  });

  it("has no trajectory from a single review", () => {
    expect(historyFor(["full", "no"])!.trajectory).toBeNull();
  });

  it("gives a closed finding no trajectory", () => {
    expect(historyFor(["no", "no", "full"])!.trajectory).toBeNull();
  });
});

describe("ranking and movement", () => {
  it("ranks reopened above an equal-length plain streak", () => {
    const list = [...build(["no", "full", "no", "no", "no"])];
    const a = findingHistories(summarizeAll(list, co, sr), list).find(
      (h) => h.questionCode === Q,
    )!;
    const plain = historyFor(["no", "no", "no"])!;
    expect(a.severity).toBeGreaterThan(plain.severity);
  });

  it("gives a closed finding no severity", () => {
    expect(historyFor(["no", "no", "full"])!.severity).toBe(0);
  });

  it("counts movement across the demo programme", () => {
    const summaries = summarizeAll(audits, contractors, subRegions);
    const histories = findingHistories(summaries, audits);
    const move = findingMovement(histories);

    expect(histories.length).toBeGreaterThan(0);
    expect(move.recurring + move.reopened).toBeGreaterThan(0);
    expect(move.closedLatest).toBe(closedFindings(histories).length);

    // Every recurring row really is at or past the threshold.
    for (const row of recurringFindings(histories)) {
      if (row.status === "recurring") {
        expect(row.openStreak).toBeGreaterThanOrEqual(RECURRING_THRESHOLD);
      }
      expect(row.timeline.length).toBeGreaterThan(1);
    }
  });

  it("only reports closures from each contractor's own latest review", () => {
    const summaries = summarizeAll(audits, contractors, subRegions);
    const histories = findingHistories(summaries, audits);
    for (const row of closedFindings(histories)) {
      const own = histories.filter((h) => h.contractorId === row.contractorId);
      const latest = own
        .map((h) => h.timeline[h.timeline.length - 1]!.quarter)
        .sort()
        .pop();
      expect(row.closedIn).toBe(latest);
    }
  });

  it("keeps each contractor's timeline separate", () => {
    const summaries = summarizeAll(audits, contractors, subRegions);
    const histories = findingHistories(summaries, audits);
    const ids = new Set(histories.map((h) => h.contractorId));
    expect(ids.size).toBeGreaterThan(1);
    for (const h of histories) {
      expect(h.id).toBe(`${h.contractorId}:${h.questionCode}`);
      expect(h.timeline.length).toBeLessThanOrEqual(4); // four quarters on record
    }
  });
});
