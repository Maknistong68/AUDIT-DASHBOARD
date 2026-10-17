/**
 * An in-memory adapter.
 *
 * Two jobs: it is what the conformance suite runs against without a
 * browser, and it is the safe default on the server, where there is no
 * `window` and a provider that assumed one would crash the render rather
 * than fall back to the baseline.
 */

import {
  EMPTY_OVERRIDES,
  normalize,
  type OverridesSnapshot,
  type StorageAdapter,
} from "./adapter";

export function memoryAdapter(
  initial: OverridesSnapshot = EMPTY_OVERRIDES,
): StorageAdapter {
  // Cloned through JSON so a caller holding `initial` cannot mutate what
  // the adapter returns — the same isolation a real store gives for free.
  let snapshot: OverridesSnapshot = normalize(
    JSON.parse(JSON.stringify(initial)),
  );
  return {
    name: "memory",
    shared: false,
    async load() {
      return normalize(JSON.parse(JSON.stringify(snapshot)));
    },
    async save(next: OverridesSnapshot) {
      snapshot = normalize(JSON.parse(JSON.stringify(next)));
    },
    async clear() {
      snapshot = EMPTY_OVERRIDES;
    },
  };
}
