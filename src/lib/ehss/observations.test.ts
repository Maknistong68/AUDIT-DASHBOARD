import { describe, expect, it } from "vitest";
import {
  applyObservationCauses,
  mergeObservationCauses,
  observationCausesEvent,
  resetObservationCauses,
  validObservationCauses,
} from "./observations";
import { EMPTY_OVERRIDES } from "./storage/adapter";
import type { RecordedObservation } from "./model";

const obs = (id: string, causes: RecordedObservation["causes"]): RecordedObservation => ({
  id,
  auditId: "af272-2026-Q3",
  kind: "gap",
  questionCode: "A1",
  text: "x",
  causes,
  causesSource: "claude",
});
const recorded = [obs("o:1", ["DOC"]), obs("o:2", ["PLN"])];

describe("mergeObservationCauses", () => {
  it("returns the recorded list untouched when nothing was corrected", () => {
    expect(mergeObservationCauses(recorded, {})).toBe(recorded);
  });

  it("gives a corrected observation its causes and the auditor as source", () => {
    const merged = mergeObservationCauses(recorded, { "o:1": ["IMP", "LED"] });
    expect(merged[0]).toMatchObject({ causes: ["IMP", "LED"], causesSource: "auditor" });
    expect(merged[1]).toBe(recorded[1]);
    // the recorded record itself is not mutated
    expect(recorded[0]).toMatchObject({ causes: ["DOC"], causesSource: "claude" });
  });

  it("ignores an override for an observation that no longer exists", () => {
    expect(mergeObservationCauses(recorded, { gone: ["DOC"] })).toEqual(recorded);
  });
});

describe("applyObservationCauses", () => {
  it("stores the correction, de-duplicated and in register order", () => {
    const next = applyObservationCauses(EMPTY_OVERRIDES, "o:1", ["LED", "DOC", "DOC"]);
    expect(next.observationCauses).toEqual({ "o:1": ["DOC", "LED"] });
    expect(EMPTY_OVERRIDES.observationCauses).toEqual({});
  });

  it("returns the same object when nothing changes", () => {
    const once = applyObservationCauses(EMPTY_OVERRIDES, "o:1", ["DOC"]);
    expect(applyObservationCauses(once, "o:1", ["DOC"])).toBe(once);
  });

  it("an empty list is a no-op, never a revert", () => {
    const once = applyObservationCauses(EMPTY_OVERRIDES, "o:1", ["DOC"]);
    expect(applyObservationCauses(once, "o:1", [])).toBe(once);
    expect(applyObservationCauses(once, "o:1", ["nope" as never])).toBe(once);
  });

  it("causes equal to the recorded ones, in any order, remove the override", () => {
    const once = applyObservationCauses(EMPTY_OVERRIDES, "o:1", ["PLN"], ["DOC", "LED"]);
    expect(once.observationCauses).toEqual({ "o:1": ["PLN"] });
    const back = applyObservationCauses(once, "o:1", ["LED", "DOC"], ["DOC", "LED"]);
    expect(back.observationCauses).toEqual({});
    // and with no override there is nothing to write
    expect(applyObservationCauses(EMPTY_OVERRIDES, "o:1", ["DOC"], ["DOC"])).toBe(
      EMPTY_OVERRIDES,
    );
  });
});

describe("resetObservationCauses", () => {
  it("deletes the override, and is a no-op without one", () => {
    const once = applyObservationCauses(EMPTY_OVERRIDES, "o:1", ["IMP"]);
    expect(resetObservationCauses(once, "o:1").observationCauses).toEqual({});
    expect(resetObservationCauses(EMPTY_OVERRIDES, "o:1")).toBe(EMPTY_OVERRIDES);
  });
});

describe("validObservationCauses", () => {
  it("gap and site take one to three distinct gap causes", () => {
    for (const kind of ["gap", "site"] as const) {
      expect(validObservationCauses(kind, ["DOC"])).toBe(true);
      expect(validObservationCauses(kind, ["DOC", "PLN", "LED"])).toBe(true);
      expect(validObservationCauses(kind, [])).toBe(false);
      expect(validObservationCauses(kind, ["DOC", "PLN", "IMP", "LED"])).toBe(false);
      expect(validObservationCauses(kind, ["DOC", "DOC"])).toBe(false);
      expect(validObservationCauses(kind, ["GOOD"])).toBe(false);
      expect(validObservationCauses(kind, ["DOC", "GOOD"])).toBe(false);
      expect(validObservationCauses(kind, ["nope" as never])).toBe(false);
    }
  });

  it("a positive takes exactly GOOD", () => {
    expect(validObservationCauses("positive", ["GOOD"])).toBe(true);
    expect(validObservationCauses("positive", [])).toBe(false);
    expect(validObservationCauses("positive", ["DOC"])).toBe(false);
    expect(validObservationCauses("positive", ["GOOD", "DOC"])).toBe(false);
    expect(validObservationCauses("positive", ["GOOD", "GOOD"])).toBe(false);
  });
});

describe("observationCausesEvent", () => {
  it("records before and after, by role", () => {
    const [e] = observationCausesEvent(EMPTY_OVERRIDES, "o:1", ["IMP"], "auditor", ["DOC"]);
    expect(e).toEqual({
      actorRole: "auditor",
      entity: "observation",
      entityId: "o:1",
      field: "causes",
      from: "DOC",
      to: "IMP",
    });
  });

  it("takes the previous correction over the recorded baseline", () => {
    const prev = applyObservationCauses(EMPTY_OVERRIDES, "o:1", ["PLN", "LED"]);
    const [e] = observationCausesEvent(prev, "o:1", ["PLN"], "admin", ["DOC"]);
    expect(e).toMatchObject({ from: "PLN, LED", to: "PLN" });
  });

  it("a reset records the recorded causes as the destination", () => {
    const prev = applyObservationCauses(EMPTY_OVERRIDES, "o:1", ["IMP"]);
    const [e] = observationCausesEvent(prev, "o:1", ["DOC"], "auditor", ["DOC"]);
    expect(e).toMatchObject({ from: "IMP", to: "DOC" });
  });

  it("records nothing when the causes did not change", () => {
    expect(observationCausesEvent(EMPTY_OVERRIDES, "o:1", ["DOC"], "auditor", ["DOC"])).toEqual([]);
  });
});
