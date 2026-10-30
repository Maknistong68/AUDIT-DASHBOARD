/**
 * Observations and the causes an auditor corrects on them.
 *
 * Pure functions, kept out of `store.tsx` so they can be tested without
 * rendering a provider. Nothing here imports `recorded-observations.ts`: that
 * module is 650 KB and is only ever loaded by dynamic import (see
 * `useObservations` in the store).
 */

import { readIssues, type IssueCode } from "./issues";
import type { ObservationKind, RecordedObservation } from "./model";
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

const GAP_CODES: IssueCode[] = ["DOC", "PLN", "IMP", "CMP", "SUP", "RES", "LED"];

/** May these causes be recorded on an observation of this kind? A gap or
 * site observation takes one to three distinct gap causes and never GOOD; a
 * positive takes exactly GOOD. Anything else is refused, not repaired. */
export function validObservationCauses(
  kind: ObservationKind,
  causes: IssueCode[],
): boolean {
  if (!Array.isArray(causes)) return false;
  if (kind === "positive") return causes.length === 1 && causes[0] === "GOOD";
  return (
    causes.length >= 1 &&
    causes.length <= 3 &&
    new Set(causes).size === causes.length &&
    causes.every((c) => GAP_CODES.includes(c))
  );
}

const sameSet = (a: IssueCode[], b: IssueCode[]) =>
  a.length === b.length && a.every((c) => b.includes(c));

/** Set one correction. Callers have already checked validity. Causes equal
 * (as a set) to the recorded ones are not a correction, so they remove any
 * override instead of writing one. Returns `prev` when nothing changes,
 * which `update()` reads as "write nothing". */
export function applyObservationCauses(
  prev: OverridesSnapshot,
  id: string,
  causes: IssueCode[],
  recorded?: IssueCode[],
): OverridesSnapshot {
  const next = readIssues(causes);
  if (next.length === 0) return prev;
  if (recorded && sameSet(next, recorded)) return resetObservationCauses(prev, id);
  const was = prev.observationCauses[id];
  if (was && was.join() === next.join()) return prev;
  return { ...prev, observationCauses: { ...prev.observationCauses, [id]: next } };
}

/** Take a correction off, so the recorded causes show again. */
export function resetObservationCauses(
  prev: OverridesSnapshot,
  id: string,
): OverridesSnapshot {
  if (!(id in prev.observationCauses)) return prev;
  const rest = { ...prev.observationCauses };
  delete rest[id];
  return { ...prev, observationCauses: rest };
}

const show = (c: IssueCode[]) => c.join(", ");

/** The trail event for a change, given the state BEFORE it. `recorded` is
 * the loaded log's causes; a previous correction wins over it as "from".
 * For a reset pass the recorded causes as `causes`. A role, never a person. */
export function observationCausesEvent(
  prev: OverridesSnapshot,
  id: string,
  causes: IssueCode[],
  role: UserRole,
  recorded?: IssueCode[],
): Array<Omit<TrailEvent, "id" | "at">> {
  const before = prev.observationCauses[id] ?? recorded;
  const after = readIssues(causes);
  if (after.length === 0 || (before && sameSet(before, after))) return [];
  return [
    {
      actorRole: role,
      entity: "observation",
      entityId: id,
      field: "causes",
      from: before ? show(before) : null,
      to: show(after),
    },
  ];
}
