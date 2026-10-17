import { describe, expect, it } from "vitest";
import {
  TRAIL_LIMIT,
  appendEvent,
  describeEvent,
  eventsFor,
  mayWrite,
  type TrailEvent,
} from "./trail";

const base: Omit<TrailEvent, "id" | "at"> = {
  actorRole: "auditor",
  entity: "audit",
  entityId: "x-2026-Q1",
  field: "status",
  from: "draft",
  to: "submitted",
};

describe("the trail records a role, never a person", () => {
  it("has no field that could hold an identity", () => {
    const event = appendEvent([], base)[0]!;
    const keys = Object.keys(event);
    // COMPLIANCE-KSA §4: the moment a field names an individual, PDPL's
    // cross-border rules apply again and this system may not run where it
    // runs. The absence is the feature.
    for (const forbidden of ["name", "email", "user", "userId", "actorName"]) {
      expect(keys).not.toContain(forbidden);
    }
    expect(event.actorRole).toBe("auditor");
  });

  it("stamps an id and a time the caller did not have to supply", () => {
    const at = new Date("2026-03-01T10:00:00.000Z");
    const event = appendEvent([], base, at)[0]!;
    expect(event.at).toBe("2026-03-01T10:00:00.000Z");
    expect(event.id).toBeTruthy();
    expect(appendEvent([], base, at)[0]!.id).not.toBe(event.id);
  });

  it("keeps the newest rather than letting a quota error lose the save", () => {
    let events: TrailEvent[] = [];
    for (let i = 0; i < TRAIL_LIMIT + 25; i++) {
      events = appendEvent(events, { ...base, field: `change ${i}` });
    }
    expect(events).toHaveLength(TRAIL_LIMIT);
    // The oldest went, not the newest: a trail that drops what just
    // happened is worse than a short one.
    expect(events[events.length - 1]!.field).toBe(`change ${TRAIL_LIMIT + 24}`);
    expect(events[0]!.field).toBe("change 25");
  });
});

describe("reading the trail", () => {
  const events = [
    { ...base, id: "1", at: "2026-01-01T00:00:00.000Z" },
    { ...base, id: "2", at: "2026-02-01T00:00:00.000Z" },
    { ...base, id: "3", at: "2026-03-01T00:00:00.000Z", entityId: "other" },
  ];

  it("returns one record's events, newest first", () => {
    const mine = eventsFor(events, "audit", "x-2026-Q1");
    expect(mine.map((e) => e.id)).toEqual(["2", "1"]);
  });

  it("describes a change in one line a person can read", () => {
    expect(describeEvent(events[0]!)).toBe("status: draft → submitted");
    expect(describeEvent({ ...events[0]!, from: null })).toBe(
      "status set to submitted",
    );
    expect(describeEvent({ ...events[0]!, to: null })).toBe(
      "status cleared (was draft)",
    );
  });
});

describe("who may write at all", () => {
  it("is the second check, after the UI hides what a viewer cannot do", () => {
    expect(mayWrite("admin")).toBe(true);
    expect(mayWrite("auditor")).toBe(true);
    // A hidden button should not be the only thing between a viewer and a
    // record. This is still not a security boundary — that needs auth.
    expect(mayWrite("viewer")).toBe(false);
    expect(mayWrite(null)).toBe(false);
  });
});
