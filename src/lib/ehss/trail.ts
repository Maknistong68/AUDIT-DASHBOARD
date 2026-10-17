/**
 * The audit trail — who changed what, when.
 *
 * An audit tool without one cannot answer the first question a dispute
 * raises: "that score was 72, it now says 68 — who changed it?" Until now
 * nothing in this system recorded that at all, so the honest answer was
 * "nobody knows".
 *
 * WHO IS A ROLE, NOT A PERSON, AND THAT IS NOT A LIMITATION OF THIS FILE.
 * `docs/COMPLIANCE-KSA.md` §4 lets this data be hosted outside the Kingdom
 * on the basis that it names nobody, and it says so explicitly: the moment
 * a field names a worker, an auditor or any other individual, PDPL's
 * cross-border rules apply again. A trail that recorded a name would
 * therefore change where this system is allowed to run.
 *
 * So the trail records the role that acted. That answers "was this changed
 * by someone entitled to change it?", which is most of what a trail is for,
 * and it is safe to build today. Attributing a change to a PERSON needs an
 * identity, an identity is personal data, and that decision belongs to the
 * DPO — see docs/FIX-PLAN.md. The schema (migration 0005) leaves the column
 * out rather than leaving it null, so adding it is a deliberate act with a
 * migration attached, not an afternoon's oversight.
 */

import type { UserRole } from "../types";

export type TrailEntity = "audit" | "action" | "contractor";

export interface TrailEvent {
  id: string;
  /** ISO timestamp. */
  at: string;
  /** The role that acted. Never a name, never an email, never an id. */
  actorRole: UserRole;
  entity: TrailEntity;
  entityId: string;
  /** What changed, in the app's own words — "status", "area B6 points". */
  field: string;
  /** Rendered as text: the trail is read by people, not joined by queries,
   * and a value that cannot be stored is a change that goes unrecorded. */
  from: string | null;
  to: string | null;
}

/** Events, newest first, for one record. */
export function eventsFor(
  events: TrailEvent[],
  entity: TrailEntity,
  entityId: string,
): TrailEvent[] {
  return events
    .filter((e) => e.entity === entity && e.entityId === entityId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * The trail is append-only and unbounded, and this one lives in a browser
 * with a few megabytes to its name. Keep the newest and drop the rest
 * rather than letting a quota error take the whole save down with it —
 * and say so, because a silently truncated trail is worse than a short one.
 */
export const TRAIL_LIMIT = 500;

export function appendEvent(
  events: TrailEvent[],
  event: Omit<TrailEvent, "id" | "at">,
  now = new Date(),
): TrailEvent[] {
  const next: TrailEvent = {
    ...event,
    id: `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: now.toISOString(),
  };
  const all = [...events, next];
  return all.length > TRAIL_LIMIT ? all.slice(all.length - TRAIL_LIMIT) : all;
}

/** A one-line description, for the panel that lists them. */
export function describeEvent(event: TrailEvent): string {
  if (event.from === null && event.to !== null) {
    return `${event.field} set to ${event.to}`;
  }
  if (event.to === null && event.from !== null) {
    return `${event.field} cleared (was ${event.from})`;
  }
  if (event.from === null && event.to === null) return event.field;
  return `${event.field}: ${event.from} → ${event.to}`;
}

/** Which roles may write at all. The UI hides what a viewer cannot do;
 * this is the second check, so a hidden button is not the only thing
 * standing between a viewer and a record. It is still not a security
 * boundary — that needs authentication, which needs the DPO's answer. */
export const WRITING_ROLES: UserRole[] = ["admin", "auditor"];

export const mayWrite = (role: UserRole | null): boolean =>
  role !== null && WRITING_ROLES.includes(role);
