"use client";

/**
 * Client data store. The recorded dataset in recorded.ts is the baseline —
 * the real Q4 2025 and Q1 2026 Health & Safety audits, and nothing invented.
 * User edits (new quarterly reviews, answer changes, contractor activation)
 * are layered on top and persisted in localStorage, so the app behaves like
 * a real system without a database.
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
} from "./recorded";
import type {
  EhssAudit,
  EhssAuditStatus,
  EhssContractor,
  EhssResponse,
  RecordedAreaScores,
  SubRegion,
} from "./model";
import { DISCIPLINES, type DisciplineScores } from "./disciplines";
import type { CriticalRiskScores } from "./critical-risks";
import type { EhssAction } from "./actions";
import {
  EMPTY_OVERRIDES,
  countOverrides,
  type OverridesSnapshot,
  type StorageAdapter,
} from "./storage/adapter";
import { localStorageAdapter } from "./storage/local";
import { appendEvent, mayWrite, type TrailEvent } from "./trail";
import type { UserRole } from "../types";
import { memoryAdapter } from "./storage/memory";

/** The overrides layered on the recorded baseline. One shape, defined by
 * the storage seam, so the provider and the adapters cannot disagree. */
type Overrides = OverridesSnapshot;

const EMPTY = EMPTY_OVERRIDES;

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

/** What this browser is holding on top of the recorded baseline. Counts
 * only — the panel that shows them needs a magnitude, not the records. */
export interface LocalEditCounts {
  audits: number;
  actions: number;
  deleted: number;
  contractors: number;
}

interface StoreValue {
  hydrated: boolean;
  /** Who changed what, when — by role. Append-only. */
  events: TrailEvent[];
  /** Whether this role may change anything at all. */
  canWrite: boolean;
  localEdits: LocalEditCounts;
  /** Where overrides are kept, and whether anyone else can see them. The
   * UI reads this instead of hard-coding "saved in this browser only", so
   * a shared adapter removes that warning by itself. */
  storage: { name: string; shared: boolean };
  subRegions: SubRegion[];
  contractors: EhssContractor[];
  audits: EhssAudit[];
  actions: EhssAction[];
  setContractorActive: (contractorId: string, active: boolean) => void;
  /** Raise an action against a finding. Id is generated here so a caller
   * cannot collide two. */
  raiseAction: (action: Omit<EhssAction, "id">) => string;
  /** Close by hand — recorded as "without evidence", which is a different
   * claim from closed by a review and must read differently. */
  closeActionByHand: (
    actionId: string,
    closure: NonNullable<EhssAction["closedByHand"]>,
  ) => void;
  /** Undo a hand closure; derived closure cannot be undone because it is
   * not a decision, it is a measurement. */
  reopenAction: (actionId: string) => void;
  deleteAction: (actionId: string) => void;
  createAudit: (input: NewAuditInput) => string;
  saveResponses: (
    auditId: string,
    responses: Record<string, EhssResponse>,
  ) => void;
  /** The 15 checklist areas as raw points. Passing an area with
   * `possible <= 0` drops it, which is how an area is un-recorded. */
  saveAreaScores: (auditId: string, areas: RecordedAreaScores) => void;
  /** Answers for a checklist other than Health & Safety — Environment,
   * Security, Worker Welfare, or one of the fourteen CRC hazards. H&S goes
   * through `saveResponses`; see ./scopes for why the two are apart. */
  saveScopedResponses: (
    auditId: string,
    scopeId: string,
    responses: Record<string, EhssResponse>,
  ) => void;
  /** Date, inspection number and quarter. Contractor is deliberately not
   * editable: an audit moved to another contractor is a different audit,
   * and would silently rewrite two contractors' trends. */
  saveAuditMeta: (
    auditId: string,
    meta: Pick<EhssAudit, "auditDate" | "inspectionNo" | "quarter">,
  ) => void;
  saveDisciplineScores: (auditId: string, scores: DisciplineScores) => void;
  saveCriticalRisks: (auditId: string, risks: CriticalRiskScores) => void;
  setAuditStatus: (auditId: string, status: EhssAuditStatus) => void;
  deleteAudit: (auditId: string) => void;
  resetLocalEdits: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function EhssStoreProvider({
  children,
  role = null,
  adapter,
}: {
  children: React.ReactNode;
  /**
   * The role acting. Recorded on every change — as a ROLE, never a name —
   * and checked before every write, so a hidden button is not the only
   * thing standing between a viewer and a record. Still not a security
   * boundary: that needs authentication. See lib/ehss/trail.ts.
   */
  role?: UserRole | null;
  /**
   * Where overrides live. Defaults to this browser; pass another and
   * nothing else in the app changes, which is the point of the seam.
   * `memoryAdapter` on the server, where there is no `window` and a
   * provider that assumed one would crash the render.
   */
  adapter?: StorageAdapter;
}) {
  const store = useMemo(
    () =>
      adapter ??
      (typeof window === "undefined" ? memoryAdapter() : localStorageAdapter()),
    [adapter],
  );
  const [overrides, setOverrides] = useState<Overrides>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let live = true;
    void store.load().then((loaded) => {
      if (!live) return;
      setOverrides(loaded);
      setHydrated(true);
    });
    return () => {
      live = false;
    };
  }, [store]);

  /**
   * Every mutation goes through here, which is what makes the trail
   * complete rather than sprinkled: a writer that forgot to record its
   * change would have to bypass the only way to change anything.
   *
   * `log` returns the events this change should record. It is given the
   * state BEFORE the change, because "status: draft → submitted" needs the
   * old value and only the caller knows where to find it.
   */
  const update = useCallback(
    (
      fn: (prev: Overrides) => Overrides,
      log?: (prev: Overrides) => Array<Omit<TrailEvent, "id" | "at">>,
    ) => {
      if (!mayWrite(role)) return;
      setOverrides((prev) => {
        let next = fn(prev);
        if (next === prev) return prev;
        for (const event of log?.(prev) ?? []) {
          next = { ...next, events: appendEvent(next.events, { ...event }) };
        }
        void store.save(next);
        return next;
      });
    },
    [store, role],
  );

  const { contractors, audits } = useMemo(() => merge(overrides), [overrides]);

  const localEdits = useMemo<LocalEditCounts>(
    () => countOverrides(overrides),
    [overrides],
  );

  const setContractorActive = useCallback(
    (contractorId: string, active: boolean) =>
      update((prev) => ({
        ...prev,
        contractorActive: { ...prev.contractorActive, [contractorId]: active },
      })),
    [update],
  );

  const raiseAction = useCallback(
    (input: Omit<EhssAction, "id">) => {
      const id = `act-${input.contractorId}-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      update(
        (prev) => ({
          ...prev,
          actions: { ...prev.actions, [id]: { ...input, id } },
        }),
        () => [
          {
            actorRole: role!,
            entity: "action",
            entityId: id,
            field: `raised against ${input.target.label}`,
            from: null,
            to: `due ${input.targetQuarter}`,
          },
        ],
      );
      return id;
    },
    [update, role],
  );

  const closeActionByHand = useCallback(
    (actionId: string, closure: NonNullable<EhssAction["closedByHand"]>) =>
      update((prev) => {
        const action = prev.actions[actionId];
        if (!action) return prev;
        return {
          ...prev,
          actions: {
            ...prev.actions,
            [actionId]: { ...action, closedByHand: closure },
          },
        };
      },
      (prev) => {
        const action = prev.actions[actionId];
        return action
          ? [
              {
                actorRole: role!,
                entity: "action" as const,
                entityId: actionId,
                field: `closed by hand (${action.target.label})`,
                from: "open",
                to: closure.reason,
              },
            ]
          : [];
      }),
    [update, role],
  );

  const reopenAction = useCallback(
    (actionId: string) =>
      update((prev) => {
        const action = prev.actions[actionId];
        if (!action) return prev;
        const { closedByHand: _dropped, ...rest } = action;
        return { ...prev, actions: { ...prev.actions, [actionId]: rest } };
      }),
    [update],
  );

  const deleteAction = useCallback(
    (actionId: string) =>
      update((prev) => {
        const actions = { ...prev.actions };
        delete actions[actionId];
        return { ...prev, actions };
      }),
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

  const saveAreaScores = useCallback(
    (auditId: string, areas: RecordedAreaScores) =>
      update((prev) => {
        const audit = currentAudit(auditId, prev);
        if (!audit) return prev;
        // An audit with no area left on record stops being an imported one:
        // dropping the key rather than keeping {} is what makes the
        // "recorded points" source genuinely gone instead of empty.
        const kept = Object.keys(areas).length > 0 ? areas : undefined;
        return {
          ...prev,
          audits: { ...prev.audits, [auditId]: { ...audit, areaScores: kept } },
        };
      },
      (prev) => {
        const was = currentAudit(auditId, prev)?.areaScores ?? {};
        const codes = [...new Set([...Object.keys(was), ...Object.keys(areas)])];
        const render = (a?: { scored: number; possible: number }) =>
          a ? `${a.scored}/${a.possible}` : null;
        return codes.flatMap((code) =>
          render(was[code]) === render(areas[code])
            ? []
            : [
                {
                  actorRole: role!,
                  entity: "audit" as const,
                  entityId: auditId,
                  field: `area ${code} points`,
                  from: render(was[code]),
                  to: render(areas[code]),
                },
              ],
        );
      }),
    [update, currentAudit, role],
  );

  const saveScopedResponses = useCallback(
    (
      auditId: string,
      scopeId: string,
      responses: Record<string, EhssResponse>,
    ) =>
      update((prev) => {
        const audit = currentAudit(auditId, prev);
        if (!audit) return prev;
        const scoped = { ...(audit.scopedResponses ?? {}) };
        // An emptied scope drops its key rather than keeping {}, so "no
        // answers" and "answered nothing" cannot drift apart in storage.
        if (Object.keys(responses).length === 0) delete scoped[scopeId];
        else scoped[scopeId] = responses;
        return {
          ...prev,
          audits: {
            ...prev.audits,
            [auditId]: {
              ...audit,
              scopedResponses: Object.keys(scoped).length > 0 ? scoped : undefined,
            },
          },
        };
      }),
    [update, currentAudit],
  );

  const saveAuditMeta = useCallback(
    (
      auditId: string,
      meta: Pick<EhssAudit, "auditDate" | "inspectionNo" | "quarter">,
    ) =>
      update((prev) => {
        const audit = currentAudit(auditId, prev);
        if (!audit) return prev;
        return {
          ...prev,
          audits: { ...prev.audits, [auditId]: { ...audit, ...meta } },
        };
      }),
    [update, currentAudit],
  );

  const saveDisciplineScores = useCallback(
    (auditId: string, scores: DisciplineScores) =>
      update(
        (prev) => {
          const audit = currentAudit(auditId, prev);
          if (!audit) return prev;
          return {
            ...prev,
            audits: {
              ...prev.audits,
              [auditId]: { ...audit, disciplineScores: scores },
            },
          };
        },
        (prev) => {
          const was = currentAudit(auditId, prev)?.disciplineScores ?? {};
          // One event per discipline that moved, not one per save: "the
          // scores changed" is not a thing anybody can act on.
          return DISCIPLINES.flatMap((d) =>
            was[d.id] === scores[d.id]
              ? []
              : [
                  {
                    actorRole: role!,
                    entity: "audit" as const,
                    entityId: auditId,
                    field: `${d.shortName} score`,
                    from: was[d.id] === undefined ? null : `${was[d.id]}%`,
                    to: scores[d.id] === undefined ? null : `${scores[d.id]}%`,
                  },
                ],
          );
        },
      ),
    [update, currentAudit, role],
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
      update(
        (prev) => {
          const audit = currentAudit(auditId, prev);
          if (!audit) return prev;
          return {
            ...prev,
            audits: { ...prev.audits, [auditId]: { ...audit, status } },
          };
        },
        (prev) => {
          const was = currentAudit(auditId, prev);
          return was && was.status !== status
            ? [
                {
                  actorRole: role!,
                  entity: "audit",
                  entityId: auditId,
                  field: "status",
                  from: was.status,
                  to: status,
                },
              ]
            : [];
        },
      ),
    [update, currentAudit, role],
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

  const resetLocalEdits = useCallback(() => {
    void store.clear();
    setOverrides(EMPTY);
  }, [store]);

  const value = useMemo<StoreValue>(
    () => ({
      hydrated,
      events: overrides.events,
      canWrite: mayWrite(role),
      localEdits,
      storage: { name: store.name, shared: store.shared },
      subRegions: baseSubRegions,
      contractors,
      audits,
      actions: Object.values(overrides.actions),
      setContractorActive,
      raiseAction,
      closeActionByHand,
      reopenAction,
      deleteAction,
      createAudit,
      saveResponses,
      saveAreaScores,
      saveScopedResponses,
      saveAuditMeta,
      saveDisciplineScores,
      saveCriticalRisks,
      setAuditStatus,
      deleteAudit,
      resetLocalEdits,
    }),
    [
      hydrated,
      overrides.events,
      role,
      localEdits,
      store,
      contractors,
      audits,
      overrides.actions,
      setContractorActive,
      raiseAction,
      closeActionByHand,
      reopenAction,
      deleteAction,
      createAudit,
      saveResponses,
      saveAreaScores,
      saveScopedResponses,
      saveAuditMeta,
      saveDisciplineScores,
      saveCriticalRisks,
      setAuditStatus,
      deleteAudit,
      resetLocalEdits,
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
