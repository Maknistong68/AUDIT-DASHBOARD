import { describe, expect, it } from "vitest";
import {
  applyObservationCauses,
  mergeObservationCauses,
  observationCausesEvent,
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

  it("an empty list takes the correction back off", () => {
    const once = applyObservationCauses(EMPTY_OVERRIDES, "o:1", ["DOC"]);
    expect(applyObservationCauses(once, "o:1", []).observationCauses).toEqual({});
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

  it("records nothing when the causes did not change", () => {
    expect(observationCausesEvent(EMPTY_OVERRIDES, "o:1", ["DOC"], "auditor", ["DOC"])).toEqual([]);
  });
});
