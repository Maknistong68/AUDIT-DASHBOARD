/**
 * The storage seam.
 *
 * Everything a user changes — reviews they created or edited, contractors
 * they deactivated, actions they raised — lives on top of the recorded
 * baseline as OVERRIDES. Today those overrides are in one browser's
 * `localStorage`; the plan is Postgres. `store.tsx` should not know which,
 * and before this interface existed it knew intimately: `localStorage.getItem`
 * was called from the middle of the provider.
 *
 * So: one interface, two implementations today and a third later, and a
 * conformance suite in `adapter.test.ts` that every implementation must
 * pass. Adding Supabase should mean writing `supabase.ts`, running that
 * suite against it, and changing one line of `store.tsx`.
 *
 * THE `shared` FLAG IS NOT DECORATION. The app currently tells the auditor
 * "saved in this browser only" and shows an admin how many local edits
 * exist, because both are true and saying otherwise would be a lie about
 * durability. Those strings read `shared` rather than hard-coding the
 * warning, so the day a shared adapter is wired in they disappear by
 * themselves instead of being hunted down.
 */

import type { EhssAction } from "../actions";
import type { EhssAudit, EhssContractor } from "../model";
import type { TrailEvent } from "../trail";

/** Everything layered on top of `recorded.ts`. */
export interface OverridesSnapshot {
  /** Contractor id -> active flag, where someone changed it. */
  contractorActive: Record<string, boolean>;
  /** Audit id -> audit, for reviews created or edited here. */
  audits: Record<string, EhssAudit>;
  /** Audits deleted, baseline ones included. */
  deletedAuditIds: string[];
  /** Actions raised against findings. No baseline — every one was raised. */
  actions: Record<string, EhssAction>;
  /** Who changed what, when — by role. Append-only; see ../trail.ts. */
  events: TrailEvent[];
  /** Contractors added here, and edits to recorded ones. Keyed by id. */
  contractors: Record<string, Partial<EhssContractor> & { id: string }>;
}

export const EMPTY_OVERRIDES: OverridesSnapshot = {
  contractorActive: {},
  audits: {},
  deletedAuditIds: [],
  actions: {},
  events: [],
  contractors: {},
};

export interface StorageAdapter {
  /** For diagnostics and the admin panel. */
  readonly name: string;
  /**
   * True when what this adapter holds is visible to other people and
   * survives this browser. Drives what the UI is allowed to claim about
   * durability — see the note above.
   */
  readonly shared: boolean;
  /** Everything on record for this user. Never throws: a storage failure
   * returns the empty snapshot, because a blocked cookie jar should degrade
   * the app to read-only, not break it. */
  load(): Promise<OverridesSnapshot>;
  /** Replace the snapshot. Never throws, for the same reason. */
  save(snapshot: OverridesSnapshot): Promise<void>;
  /** Drop everything this adapter holds. */
  clear(): Promise<void>;
}

/**
 * Normalize whatever came back from storage.
 *
 * A snapshot can be older than the code reading it — a browser holds what
 * it held last quarter, and a database holds what the previous deploy
 * wrote. Every field is defaulted rather than trusted, so a missing key
 * reads as empty instead of as `undefined.length`.
 */
export function normalize(raw: unknown): OverridesSnapshot {
  const parsed = (raw ?? {}) as Partial<OverridesSnapshot>;
  return {
    contractorActive: parsed.contractorActive ?? {},
    audits: parsed.audits ?? {},
    deletedAuditIds: parsed.deletedAuditIds ?? [],
    actions: parsed.actions ?? {},
    events: parsed.events ?? [],
    contractors: parsed.contractors ?? {},
  };
}

/** Is there anything in this snapshot at all? */
export function isEmpty(snapshot: OverridesSnapshot): boolean {
  return (
    Object.keys(snapshot.contractorActive).length === 0 &&
    Object.keys(snapshot.audits).length === 0 &&
    snapshot.deletedAuditIds.length === 0 &&
    Object.keys(snapshot.actions).length === 0
  );
}

/** How much a snapshot holds, for the panel that offers to discard it. */
export function countOverrides(snapshot: OverridesSnapshot): {
  audits: number;
  deleted: number;
  contractors: number;
  actions: number;
} {
  return {
    audits: Object.keys(snapshot.audits).length,
    deleted: snapshot.deletedAuditIds.length,
    contractors: Object.keys(snapshot.contractorActive).length,
    actions: Object.keys(snapshot.actions).length,
  };
}
