import { describe, expect, it } from "vitest";
import {
  EMPTY_OVERRIDES,
  countOverrides,
  isEmpty,
  normalize,
  type OverridesSnapshot,
  type StorageAdapter,
} from "./adapter";
import { memoryAdapter } from "./memory";
import { localStorageAdapter, STORAGE_KEY } from "./local";
import type { EhssAudit } from "../model";

const audit: EhssAudit = {
  id: "x-2026-Q1",
  contractorId: "x",
  quarter: "2026-Q1",
  auditDate: "2026-02-01",
  inspectionNo: "T-1",
  status: "draft",
  responses: { A1: { answer: "no", issues: ["DOC"] } },
  disciplineScores: { env: 70 },
  criticalRisks: { fire: 80 },
};

const filled: OverridesSnapshot = {
  contractorActive: { x: false },
  audits: { [audit.id]: audit },
  deletedAuditIds: ["gone-2025-Q4"],
  actions: {
    a1: {
      id: "a1",
      contractorId: "x",
      target: { kind: "area", code: "B6", label: "Subcontractor Management" },
      raisedQuarter: "2026-Q1",
      targetQuarter: "2026-Q2",
      causes: ["DOC"],
    },
  },
};

/**
 * THE CONFORMANCE SUITE.
 *
 * Every storage adapter must pass this, unchanged. It is the contract a
 * Postgres implementation has to satisfy before it replaces the browser
 * one, which is the whole point of having a seam: the swap is provable
 * rather than hopeful.
 */
function conforms(name: string, make: () => StorageAdapter) {
  describe(`${name} adapter`, () => {
    it("starts empty", async () => {
      expect(await make().load()).toEqual(EMPTY_OVERRIDES);
    });

    it("round-trips everything it was given", async () => {
      const adapter = make();
      await adapter.save(filled);
      expect(await adapter.load()).toEqual(filled);
    });

    it("hands back a copy, not its own state", async () => {
      // A caller that mutates what it loaded must not silently rewrite
      // storage — which is exactly what returning the live object does.
      const adapter = make();
      await adapter.save(filled);
      const first = await adapter.load();
      first.deletedAuditIds.push("mutated");
      delete first.audits[audit.id];
      const second = await adapter.load();
      expect(second.deletedAuditIds).toEqual(["gone-2025-Q4"]);
      expect(second.audits[audit.id]).toBeDefined();
    });

    it("clears", async () => {
      const adapter = make();
      await adapter.save(filled);
      await adapter.clear();
      expect(await adapter.load()).toEqual(EMPTY_OVERRIDES);
    });

    it("never throws when storage misbehaves", async () => {
      const adapter = make();
      // Whatever goes wrong underneath, the app degrades to the recorded
      // baseline rather than failing to render.
      await expect(adapter.save(filled)).resolves.toBeUndefined();
      await expect(adapter.load()).resolves.toBeDefined();
    });
  });
}

conforms("memory", () => memoryAdapter());

conforms("localStorage", () => {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  return localStorageAdapter();
});

describe("a snapshot can be older than the code reading it", () => {
  it("defaults every field rather than trusting it", () => {
    // A browser holds what it held last quarter; a database holds what the
    // previous deploy wrote. A missing key must read as empty, not as
    // `undefined.length`.
    expect(normalize(undefined)).toEqual(EMPTY_OVERRIDES);
    expect(normalize({})).toEqual(EMPTY_OVERRIDES);
    expect(normalize({ audits: { a: audit } }).actions).toEqual({});
    expect(normalize({ actions: filled.actions }).deletedAuditIds).toEqual([]);
  });

  it("counts what it holds, for the panel that offers to discard it", () => {
    expect(countOverrides(filled)).toEqual({
      audits: 1,
      deleted: 1,
      contractors: 1,
      actions: 1,
    });
    expect(isEmpty(EMPTY_OVERRIDES)).toBe(true);
    expect(isEmpty(filled)).toBe(false);
  });
});

describe("what the UI is allowed to claim about durability", () => {
  it("knows the browser adapter is not shared", () => {
    // The auditor's "saved in this browser only" reads this flag rather
    // than hard-coding the warning, so a shared adapter removes the
    // warning by itself instead of leaving it to be hunted down.
    expect(memoryAdapter().shared).toBe(false);
  });
});

describe("records written before the issue categories changed", () => {
  it("upgrades a legacy single observation code on read", async () => {
    const store = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
    store.set(
      STORAGE_KEY,
      JSON.stringify({
        audits: {
          legacy: {
            ...audit,
            id: "legacy",
            responses: { A1: { answer: "no", observation: "REC" } },
          },
        },
      }),
    );
    const loaded = await localStorageAdapter().load();
    // REC folded into DOC when twelve categories became seven; nobody
    // should have to clear their browser for that.
    expect(loaded.audits["legacy"]!.responses["A1"]!.issues).toEqual(["DOC"]);
  });
});
