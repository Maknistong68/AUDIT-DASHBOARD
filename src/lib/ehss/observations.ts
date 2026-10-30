/**
 * Observations and the causes an auditor corrects on them.
 *
 * Pure functions, kept out of `store.tsx` so they can be tested without
 * rendering a provider. Nothing here imports `recorded-observations.ts`: that
 * module is 650 KB and is only ever loaded by dynamic import (see
 * `useObservations` in the store).
 */

import { readIssues, type IssueCode } from "./issues";
import type { RecordedObservation } from "./model";
import type { OverridesSnapshot } from "./storage/adapter";
import type { TrailEvent } from "./trail";
import type { UserRole } from "../types";

/** The recorded list with corrections laid over it. An overridden
 * observation carries the auditor's causes and says so. Returns `recorded`
 * itself when there is nothing to lay over. */
export function mergeObservationCauses(
  recorded: RecordedObservation[],
  overrides: Record<string, IssueCode[]>,
): RecordedObservation[] {
  if (Object.keys(overrides).length === 0) return recorded;
  return recorded.map((o) => {
    const causes = overrides[o.id];
    return causes ? { ...o, causes, causesSource: "auditor" as const } : o;
  });
}

/** Set (or, with an empty list, take back) one correction. Returns `prev`
 * when nothing changes, which `update()` reads as "write nothing". */
export function applyObservationCauses(
  prev: OverridesSnapshot,
  id: string,
  causes: IssueCode[],
): OverridesSnapshot {
  const next = readIssues(causes);
  const was = prev.observationCauses[id];
  if (next.length === 0) {
    if (!was) return prev;
    const rest = { ...prev.observationCauses };
    delete rest[id];
    return { ...prev, observationCauses: rest };
  }
  if (was && was.join() === next.join()) return prev;
  return { ...prev, observationCauses: { ...prev.observationCauses, [id]: next } };
}

const show = (c: IssueCode[]) => c.join(", ");

/** The trail event for a change, given the state BEFORE it. `recorded` is
 * the baseline's causes when the log is loaded; a previous correction wins
 * over it. A role, never a person. */
export function observationCausesEvent(
  prev: OverridesSnapshot,
  id: string,
  causes: IssueCode[],
  role: UserRole,
  recorded?: IssueCode[],
): Array<Omit<TrailEvent, "id" | "at">> {
  const before = prev.observationCauses[id] ?? recorded;
  const after = readIssues(causes);
  if ((before ? show(before) : null) === (after.length ? show(after) : null)) {
    return [];
  }
  return [
    {
      actorRole: role,
      entity: "observation",
      entityId: id,
      field: "causes",
      from: before ? show(before) : null,
      to: after.length ? show(after) : null,
    },
  ];
}
