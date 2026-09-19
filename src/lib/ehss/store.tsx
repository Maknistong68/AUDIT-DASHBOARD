"use client";

/**
 * Client data store. The built-in dataset in mock.ts is the baseline; user
 * edits (new quarterly reviews, answer changes, contractor activation) are
 * layered on top and persisted in localStorage, so the demo behaves like a
 * real system without a database.
 *
 * SSR safety: state starts as the baseline (so the server and first client
 * render agree), then overrides are applied after mount. `hydrated` says
 * whether that has happened — pages that look up a possibly user-created
 * record must wait for it before deciding something is missing.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  audits as baseAudits,
  contractors as baseContractors,
  subRegions as baseSubRegions,
} from "./mock";
import type {
  EhssAudit,
  EhssAuditStatus,
  EhssContractor,
  EhssResponse,
  SubRegion,
} from "./model";
import type { DisciplineScores } from "./disciplines";
import type { CriticalRiskScores } from "./critical-risks";

const STORAGE_KEY = "ehss-demo-v1";

interface Overrides {
  /** Contractor id -> active flag, when the user changed it. */
  contractorActive: Record<string, boolean>;
  /** Audit id -> audit, for reviews the user created or edited. */
  audits: Record<string, EhssAudit>;
  /** Audits the user deleted (baseline ones included). */
  deletedAuditIds: string[];
}

const EMPTY: Overrides = { contractorActive: {}, audits: {}, deletedAuditIds: [] };

function readOverrides(): Overrides {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Overrides>;
    return {
      contractorActive: parsed.contractorActive ?? {},
      audits: parsed.audits ?? {},
      deletedAuditIds: parsed.deletedAuditIds ?? [],
    };
  } catch {
    return EMPTY; // private mode, blocked storage, or corrupt payload
  }
}

function writeOverrides(o: Overrides): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
  } catch {
    // Storage unavailable — the session still works, it just won't persist.
  }
}

function merge(o: Overrides): {
  contractors: EhssContractor[];
  audits: EhssAudit[];
} {
  const contractors = baseContractors.map((c) =>
    c.id in o.contractorActive
      ? { ...c, active: o.contractorActive[c.id]! }
      : c,
  );
  const deleted = new Set(o.deletedAuditIds);
  const byId = new Map<string, EhssAudit>();
  for (const a of baseAudits) if (!deleted.has(a.id)) byId.set(a.id, a);
  for (const a of Object.values(o.audits)) if (!deleted.has(a.id)) byId.set(a.id, a);
  return { contractors, audits: [...byId.values()] };
}

export interface NewAuditInput {
  contractorId: string;
  quarter: string;
  auditDate: string;
}

interface StoreValue {
  hydrated: boolean;
  subRegions: SubRegion[];
  contractors: EhssContractor[];
  audits: EhssAudit[];
  setContractorActive: (contractorId: string, active: boolean) => void;
  createAudit: (input: NewAuditInput) => string;
  saveResponses: (
    auditId: string,
    responses: Record<string, EhssResponse>,
  ) => void;
  saveDisciplineScores: (auditId: string, scores: DisciplineScores) => void;
  saveCriticalRisks: (auditId: string, risks: CriticalRiskScores) => void;
  setAuditStatus: (auditId: string, status: EhssAuditStatus) => void;
  deleteAudit: (auditId: string) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function EhssStoreProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Overrides>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOverrides(readOverrides());
    setHydrated(true);
  }, []);

  const update = useCallback((fn: (prev: Overrides) => Overrides) => {
    setOverrides((prev) => {
      const next = fn(prev);
      writeOverrides(next);
      return next;
    });
  }, []);

  const { contractors, audits } = useMemo(() => merge(overrides), [overrides]);

  const setContractorActive = useCallback(
    (contractorId: string, active: boolean) =>
      update((prev) => ({
        ...prev,
        contractorActive: { ...prev.contractorActive, [contractorId]: active },
      })),
    [update],
  );

  const createAudit = useCallback(
    ({ contractorId, quarter, auditDate }: NewAuditInput) => {
      const id = `${contractorId}-${quarter}-${Date.now().toString(36)}`;
      const contractor = baseContractors.find((c) => c.id === contractorId);
      const audit: EhssAudit = {
        id,
        contractorId,
        quarter,
        auditDate,
        inspectionNo: `EHSS-${quarter}-${contractor?.code ?? contractorId}`,
        status: "draft",
        responses: {},
        disciplineScores: {},
        criticalRisks: {},
      };
      update((prev) => ({ ...prev, audits: { ...prev.audits, [id]: audit } }));
      return id;
    },
    [update],
  );

  const currentAudit = useCallback(
    (auditId: string, prev: Overrides): EhssAudit | undefined =>
      prev.audits[auditId] ?? baseAudits.find((a) => a.id === auditId),
    [],
  );

  const saveResponses = useCallback(
    (auditId: string, responses: Record<string, EhssResponse>) =>
      update((prev) => {
        const audit = currentAudit(auditId, prev);
        if (!audit) return prev;
        return {
          ...prev,
          audits: { ...prev.audits, [auditId]: { ...audit, responses } },
        };
      }),
    [update, currentAudit],
  );

  const saveDisciplineScores = useCallback(
    (auditId: string, scores: DisciplineScores) =>
      update((prev) => {
        const audit = currentAudit(auditId, prev);
        if (!audit) return prev;
        return {
          ...prev,
          audits: {
            ...prev.audits,
            [auditId]: { ...audit, disciplineScores: scores },
          },
        };
      }),
    [update, currentAudit],
  );

  const saveCriticalRisks = useCallback(
    (auditId: string, risks: CriticalRiskScores) =>
      update((prev) => {
        const audit = currentAudit(auditId, prev);
        if (!audit) return prev;
        return {
          ...prev,
          audits: {
            ...prev.audits,
            [auditId]: { ...audit, criticalRisks: risks },
          },
        };
      }),
    [update, currentAudit],
  );

  const setAuditStatus = useCallback(
    (auditId: string, status: EhssAuditStatus) =>
      update((prev) => {
        const audit = currentAudit(auditId, prev);
        if (!audit) return prev;
        return {
          ...prev,
          audits: { ...prev.audits, [auditId]: { ...audit, status } },
        };
      }),
    [update, currentAudit],
  );

  const deleteAudit = useCallback(
    (auditId: string) =>
      update((prev) => {
        const audits = { ...prev.audits };
        delete audits[auditId];
        return {
          ...prev,
          audits,
          deletedAuditIds: [...new Set([...prev.deletedAuditIds, auditId])],
        };
      }),
    [update],
  );

  const resetDemo = useCallback(() => update(() => EMPTY), [update]);

  const value = useMemo<StoreValue>(
    () => ({
      hydrated,
      subRegions: baseSubRegions,
      contractors,
      audits,
      setContractorActive,
      createAudit,
      saveResponses,
      saveDisciplineScores,
      saveCriticalRisks,
      setAuditStatus,
      deleteAudit,
      resetDemo,
    }),
    [
      hydrated,
      contractors,
      audits,
      setContractorActive,
      createAudit,
      saveResponses,
      saveDisciplineScores,
      saveCriticalRisks,
      setAuditStatus,
      deleteAudit,
      resetDemo,
    ],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useEhss(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useEhss must be used inside EhssStoreProvider");
  return ctx;
}
