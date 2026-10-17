/**
 * The browser adapter — what the app runs on until the database lands.
 *
 * Everything it holds is visible to exactly one person on exactly one
 * machine, which is why `shared` is false and why the UI says so out loud.
 */

import { readIssues } from "../issues";
import type { EhssAudit } from "../model";
import {
  EMPTY_OVERRIDES,
  normalize,
  type OverridesSnapshot,
  type StorageAdapter,
} from "./adapter";

/* Renamed from "ehss-demo-v1" when the generated demo dataset was replaced
 * by the real audits. The rename is deliberate: it orphans anything a
 * browser still held from the demo era, which would otherwise keep
 * surfacing contractors and reviews that no longer exist. */
export const STORAGE_KEY = "ehss-v2";

/**
 * Reviews saved before issue categories replaced the single OB code carry
 * `observation` instead of `issues`. Upgrade them on read rather than
 * forcing anyone to clear their browser — `readIssues` maps the old code to
 * its nearest category and ignores anything unrecognised.
 */
function upgradeAudits(
  audits: Record<string, EhssAudit>,
): Record<string, EhssAudit> {
  const out: Record<string, EhssAudit> = {};
  for (const [id, audit] of Object.entries(audits)) {
    const responses: EhssAudit["responses"] = {};
    for (const [code, r] of Object.entries(audit.responses ?? {})) {
      const legacy = r as { answer: EhssAudit["responses"][string]["answer"] } & {
        issues?: unknown;
        observation?: unknown;
      };
      responses[code] = {
        answer: legacy.answer,
        issues: readIssues(legacy.issues ?? legacy.observation),
      };
    }
    out[id] = { ...audit, responses, criticalRisks: audit.criticalRisks ?? {} };
  }
  return out;
}

export function localStorageAdapter(): StorageAdapter {
  return {
    name: "browser",
    shared: false,
    async load() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return EMPTY_OVERRIDES;
        const snapshot = normalize(JSON.parse(raw));
        return { ...snapshot, audits: upgradeAudits(snapshot.audits) };
      } catch {
        // Private mode, blocked storage, or a corrupt payload. The app
        // degrades to the recorded baseline rather than breaking.
        return EMPTY_OVERRIDES;
      }
    },
    async save(snapshot: OverridesSnapshot) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // Storage unavailable or full — the session still works, it just
        // will not persist. Failing loudly here would lose the edit as
        // well as the save.
      }
    },
    async clear() {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* see above */
      }
    },
  };
}
