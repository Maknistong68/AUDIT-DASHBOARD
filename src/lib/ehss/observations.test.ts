/**
 * "What was seen" — the one free-text field in the audit, and the control
 * that lets it exist at all.
 *
 * docs/COMPLIANCE-KSA.md §2 used to say the absence of a comments box was
 * "structural, not a policy someone has to remember". The box exists now
 * (owner's instruction, 2026-10-18), so what has to be enforced is the
 * absence of IDENTIFIERS in it, and an unenforced rule is exactly the
 * policy §2 warned about. These tests are that enforcement.
 *
 * Also pinned here: that a note survives the reducers. Every one of them
 * used to rebuild a response as exactly `{ answer, issues }`, so an
 * observation written against a Partial vanished the moment the auditor
 * changed their mind to No — silently, with no error and no test.
 */

import { describe, expect, it } from "vitest";
import { NOTE_MAX, noteCaution, noteProblem } from "./model";
import {
  withAnswer,
  withGoodPractice,
  withIssue,
  withNote,
  type Responses,
} from "./answers";
import { areaPoints, areaRanking, summarizeAll } from "./summaries";
import { audits, contractors, subRegions } from "./recorded";
import { TARGET_SCORE } from "./disciplines";

describe("the guard on what may be typed", () => {
  it("accepts an observation about a condition", () => {
    expect(
      noteProblem(
        "Three of eight subcontractor packs had no HSSE evaluation attached.",
      ),
    ).toBeNull();
    expect(noteProblem("")).toBeNull();
    expect(noteProblem("   ")).toBeNull();
  });

  it("refuses an email address", () => {
    expect(noteProblem("sent to hse.lead@contractor.com on Monday")).toMatch(
      /email/,
    );
  });

  it("refuses a phone number", () => {
    expect(noteProblem("supervisor reachable on +966 50 123 4567")).toMatch(
      /phone/,
    );
    expect(noteProblem("called 0501234567 twice")).toMatch(/phone/);
  });

  it("refuses an identity document reference", () => {
    for (const text of [
      "iqama not produced at the gate",
      "Passport held by the sponsor",
      "ID No. not on the badge",
    ]) {
      expect(noteProblem(text)).not.toBeNull();
    }
  });

  it("refuses somebody's name", () => {
    expect(noteProblem("Eng. Rashid signed the permit himself")).toMatch(
      /name/,
    );
    expect(noteProblem("operator: Mohammed was not inducted")).toMatch(/name/);
  });

  it("refuses a narrative", () => {
    expect(noteProblem("x".repeat(NOTE_MAX + 1))).toMatch(/max 300/);
    expect(noteProblem("x".repeat(NOTE_MAX))).toBeNull();
  });

  it("WARNS, and does not refuse, a long number that is probably a permit", () => {
    // A CR number, a permit number and a work order all look like this, and
    // a validator that traps a legitimate observation teaches auditors to
    // route around it rather than to write a better one.
    const text = "CR 1010123456 not displayed at the gate";
    expect(noteProblem(text)).toBeNull();
    expect(noteCaution(text)).toMatch(/permit or CR/);
  });

  it("does not stack a caution on something already refused", () => {
    expect(noteCaution("call +966 50 123 4567 about iqama 2412345678")).toBeNull();
  });
});

describe("a note survives the answer reducers", () => {
  const seed = (): Responses =>
    withNote(
      withAnswer({}, "B6.2", "partial"),
      "B6.2",
      "No evaluation attached to the electrical package.",
    );

  it("is attached once there is an answer", () => {
    expect(seed()["B6.2"]!.note).toBe(
      "No evaluation attached to the electrical package.",
    );
  });

  it("refuses to attach to a question with no answer", () => {
    const before: Responses = {};
    expect(withNote(before, "B6.2", "something")).toBe(before);
  });

  it("survives Partial becoming No", () => {
    const next = withAnswer(seed(), "B6.2", "no");
    expect(next["B6.2"]!.answer).toBe("no");
    expect(next["B6.2"]!.note).toBeDefined();
  });

  it("survives a cause being toggled on and off", () => {
    const on = withIssue(seed(), "B6.2", "DOC");
    expect(on["B6.2"]!.issues).toEqual(["DOC"]);
    expect(on["B6.2"]!.note).toBeDefined();
    expect(withIssue(on, "B6.2", "DOC")["B6.2"]!.note).toBeDefined();
  });

  it("survives a Full answer being marked good practice", () => {
    const full = withNote(withAnswer({}, "C1.1", "full"), "C1.1", "Toolbox talks observed.");
    const marked = withGoodPractice(full, "C1.1", true);
    expect(marked["C1.1"]!.issues).toEqual(["GOOD"]);
    expect(marked["C1.1"]!.note).toBe("Toolbox talks observed.");
  });

  it("clears to absent rather than to an empty string", () => {
    const cleared = withNote(seed(), "B6.2", "   ");
    expect("note" in cleared["B6.2"]!).toBe(false);
  });

  it("returns the same object when nothing changed", () => {
    // The store short-circuits on referential identity, so a reducer that
    // always returns a new object would save and log on every keystroke.
    const before = seed();
    expect(withNote(before, "B6.2", before["B6.2"]!.note!)).toBe(before);
  });
});

describe("the points behind a percentage", () => {
  const nbc = audits.find(
    (a) => a.contractorId === "nbc026" && a.quarter === "2026-Q1",
  )!;

  it("reports NBC's subcontractor management as 2 of 11 points", () => {
    const points = areaPoints(nbc, "B6")!;
    expect(points.source).toBe("points");
    expect(points.scored).toBe(2);
    expect(points.possible).toBe(11);
  });

  it("says how much of the area was not applicable", () => {
    // B6 is worth 15 when every question applies. NBC was asked 11 points'
    // worth of it, which is why 2/11 and not 2/15 — the workbook's own rule
    // and the reason `possible` is stored per audit.
    const points = areaPoints(nbc, "B6")!;
    expect(points.nominal).toBe(15);
    expect(points.notApplicable).toBe(4);
  });

  it("agrees with the percentage the rest of the app shows", () => {
    const points = areaPoints(nbc, "B6")!;
    const pct = Math.round((points.scored / points.possible) * 1000) / 10;
    expect(pct).toBeCloseTo(18.2, 1);
  });

  it("scores from ANSWERS once every question in the area is answered", () => {
    // The same per-area precedence `areaSource()` owns: recorded points
    // until the area is completely answered, the answers after that.
    const answered = {
      ...nbc,
      responses: Object.fromEntries(
        ["B6.1", "B6.2", "B6.3", "B6.4", "B6.5", "B6.6", "B6.7", "B6.8", "B6.9"].map(
          (code) => [code, { answer: "full" as const, issues: [] }],
        ),
      ),
    };
    const points = areaPoints(answered, "B6")!;
    expect(points.source).toBe("answers");
    expect(points.scored).toBe(15);
    expect(points.possible).toBe(15);
  });

  it("is null for a code that is not an area", () => {
    expect(areaPoints(nbc, "Z9")).toBeNull();
  });
});

describe("where one contractor stands on one area", () => {
  const all = summarizeAll(audits, contractors, subRegions);

  it("ranks NBC fourth lowest of eleven on B6, with nobody at target", () => {
    const rank = areaRanking("B6", all, "2026-Q1", "nbc026")!;
    expect(rank.rank).toBe(4);
    expect(rank.of).toBe(11);
    expect(rank.atTarget).toBe(0);
    expect(rank.mean).toBeLessThan(TARGET_SCORE);
  });

  it("ranks worst first, so rank 1 is the lowest score", () => {
    const worst = areaRanking("B6", all, "2026-Q1", "ppco322")!;
    expect(worst.rank).toBe(1);
  });

  it("is null for a contractor not audited in that quarter", () => {
    expect(areaRanking("B6", all, "2026-Q1", "nobody")).toBeNull();
    expect(areaRanking("B6", all, null, "nbc026")).toBeNull();
  });
});
