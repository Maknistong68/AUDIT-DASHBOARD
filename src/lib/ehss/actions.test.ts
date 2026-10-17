import { describe, expect, it } from "vitest";
import {
  actionOwners,
  actionState,
  defaultTargetQuarter,
  isClosed,
  tallyActions,
  targetScoreIn,
  type EhssAction,
} from "./actions";
import { audits } from "./recorded";
import { TARGET_SCORE } from "./disciplines";
import type { EhssAudit } from "./model";

const CONTRACTOR = "abya112";
const reviews = audits.filter((a) => a.contractorId === CONTRACTOR);

const action = (over: Partial<EhssAction> = {}): EhssAction => ({
  id: "a1",
  contractorId: CONTRACTOR,
  target: { kind: "area", code: "B6", label: "Subcontractor Management" },
  raisedQuarter: "2025-Q4",
  targetQuarter: "2026-Q1",
  causes: ["DOC"],
  ...over,
});

describe("an action's owner is a function, never a person", () => {
  it("derives the owner from the causes and never holds a name", () => {
    expect(actionOwners(action({ causes: ["DOC"] }))).toEqual([
      "Contractor EHSS management",
    ]);
    expect(actionOwners(action({ causes: ["PLN", "LED"] }))).toEqual([
      "Planning and engineering",
      "Contractor senior management",
    ]);
    // Deduped: two causes owned by the same function name it once.
    const owners = actionOwners(action({ causes: ["DOC", "DOC"] }));
    expect(owners).toHaveLength(1);
  });

  it("drops the placeholder owner of the good-practice category", () => {
    expect(actionOwners(action({ causes: ["GOOD"] }))).toEqual([]);
  });

  it("has no field anywhere that could hold a person", () => {
    const keys = Object.keys(action());
    expect(keys).not.toContain("assignee");
    expect(keys).not.toContain("owner");
    expect(keys).not.toContain("notes");
    expect(keys).not.toContain("comment");
  });
});

describe("closure is derived from the next review, not from a tick", () => {
  it("stays open until a later review measures it at target", () => {
    // B6 for this contractor is far below target in both quarters.
    const state = actionState(action(), reviews, "2026-Q1");
    expect(state.status).toBe("open");
    expect(isClosed(state)).toBe(false);
  });

  it("closes, with the review that closed it as the evidence", () => {
    const lifted: EhssAudit[] = reviews.map((a) =>
      a.quarter === "2026-Q1" && a.areaScores
        ? { ...a, areaScores: { ...a.areaScores, B6: { scored: 11, possible: 11 } } }
        : a,
    );
    const state = actionState(action(), lifted, "2026-Q1");
    expect(state.status).toBe("closed-by-review");
    expect(state.evidence).toEqual({ quarter: "2026-Q1", score: 100 });
    expect(state.evidence!.score).toBeGreaterThanOrEqual(TARGET_SCORE);
  });

  it("is never closed by the review that raised it", () => {
    // Raised in Q1 2026 against an area already at target in Q1 2026: only
    // a LATER review can close it, or an action could be born closed.
    const lifted: EhssAudit[] = reviews.map((a) =>
      a.quarter === "2026-Q1" && a.areaScores
        ? { ...a, areaScores: { ...a.areaScores, B6: { scored: 11, possible: 11 } } }
        : a,
    );
    const state = actionState(
      action({ raisedQuarter: "2026-Q1", targetQuarter: "2026-Q2" }),
      lifted,
      "2026-Q1",
    );
    expect(state.status).toBe("open");
  });

  it("cannot be closed by a draft", () => {
    const drafted: EhssAudit[] = reviews.map((a) =>
      a.quarter === "2026-Q1" && a.areaScores
        ? {
            ...a,
            status: "draft" as const,
            areaScores: { ...a.areaScores, B6: { scored: 11, possible: 11 } },
          }
        : a,
    );
    // Otherwise a register could be cleared by opening a form.
    expect(actionState(action(), drafted, "2026-Q1").status).not.toBe(
      "closed-by-review",
    );
  });

  it("goes overdue once its target quarter has passed", () => {
    const state = actionState(action(), reviews, "2026-Q3");
    expect(state.status).toBe("overdue");
    expect(state.overdueBy).toBe(2);
  });

  it("reads a hand closure as a different thing from closed", () => {
    const byHand = action({
      closedByHand: { quarter: "2026-Q1", reason: "out-of-scope" },
    });
    const state = actionState(byHand, reviews, "2026-Q1");
    expect(state.status).toBe("closed-without-evidence");
    expect(isClosed(state)).toBe(true);
  });

  it("lets a review override a hand closure, not the other way round", () => {
    const lifted: EhssAudit[] = reviews.map((a) =>
      a.quarter === "2026-Q1" && a.areaScores
        ? { ...a, areaScores: { ...a.areaScores, B6: { scored: 11, possible: 11 } } }
        : a,
    );
    const byHand = action({
      closedByHand: { quarter: "2026-Q1", reason: "superseded" },
    });
    // Measurement beats assertion.
    expect(actionState(byHand, lifted, "2026-Q1").status).toBe(
      "closed-by-review",
    );
  });
});

describe("the register reads an area and a hazard the same way", () => {
  it("scores an area target from the review", () => {
    const q4 = reviews.find((a) => a.quarter === "2025-Q4")!;
    const score = targetScoreIn(q4, {
      kind: "area",
      code: "B6",
      label: "Subcontractor Management",
    });
    expect(score).not.toBeNull();
    expect(score).toBeLessThan(TARGET_SCORE);
  });

  it("scores a hazard target, and reports null when out of scope", () => {
    const q4 = reviews.find((a) => a.quarter === "2025-Q4")!;
    expect(
      targetScoreIn(q4, { kind: "risk", code: "fire", label: "Fire" }),
    ).toBeNull();
    const scoped = { ...q4, criticalRisks: { fire: 95 } };
    expect(
      targetScoreIn(scoped, { kind: "risk", code: "fire", label: "Fire" }),
    ).toBe(95);
  });

  it("tallies a register", () => {
    const tally = tallyActions(
      [
        action({ id: "a" }),
        action({ id: "b", targetQuarter: "2025-Q4" }),
        action({
          id: "c",
          closedByHand: { quarter: "2026-Q1", reason: "out-of-scope" },
        }),
      ],
      reviews,
      "2026-Q1",
    );
    expect(tally).toEqual({
      open: 1,
      overdue: 1,
      closedByReview: 0,
      closedWithoutEvidence: 1,
    });
  });

  it("targets the next quarter by default — nothing can be verified sooner", () => {
    expect(defaultTargetQuarter("2026-Q4")).toBe("2027-Q1");
  });
});
