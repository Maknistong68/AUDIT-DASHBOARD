"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnalysisTabs } from "@/components/AnalysisTabs";
import { CauseChart } from "@/components/observations/CauseChart";
import { ObservationRow } from "@/components/observations/ObservationRow";
import { GAP_CATEGORIES } from "@/lib/ehss/issues";
import { quarterLabel } from "@/lib/ehss/model";
import {
  causeCounts,
  filterLog,
  logFilterToParams,
  parseLogFilter,
  toLogRows,
  type LogFilter,
} from "@/lib/ehss/observation-log";
import { useEhss, useObservations } from "@/lib/ehss/store";
import { checklistAreas, summarizeAll } from "@/lib/ehss/summaries";

const PAGE = 50;
const AREAS = checklistAreas();
const KIND_OPTIONS = [
  { value: "gap", label: "Gap" },
  { value: "positive", label: "Positive" },
  { value: "site", label: "Site" },
] as const;

export function ObservationsClient() {
  // Re-keyed by Retry: a failed import is only tried again on a fresh mount.
  const [attempt, setAttempt] = useState(0);
  return <Log key={attempt} retry={() => setAttempt((n) => n + 1)} />;
}

function Log({ retry }: { retry: () => void }) {
  const {
    audits,
    contractors,
    subRegions,
    canWrite,
    hydrated,
    setObservationCauses,
    resetObservationCauses,
  } = useEhss();
  const { observations, loaded, error } = useObservations();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // Everything but the search text lives in the URL. The text is typed into
  // local state so the input never lags behind a router round trip; the URL
  // follows it.
  const urlFilter = useMemo(() => parseLogFilter(new URLSearchParams(search.toString())), [search]);
  const [q, setQ] = useState(urlFilter.q);
  const filter = useMemo<LogFilter>(() => ({ ...urlFilter, q }), [urlFilter, q]);
  const [page, setPage] = useState(0);

  const change = useCallback(
    (patch: Partial<LogFilter>) => {
      const next = { ...filter, ...patch };
      const qs = logFilterToParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      setPage(0);
    },
    [pathname, router, filter],
  );

  const ready = hydrated && loaded;
  const summaries = useMemo(
    () => summarizeAll(audits, contractors, subRegions),
    [audits, contractors, subRegions],
  );
  const rows = useMemo(
    () =>
      toLogRows(observations, summaries).sort(
        (a, b) =>
          b.quarter.localeCompare(a.quarter) ||
          a.contractorName.localeCompare(b.contractorName) ||
          (a.questionCode ?? "").localeCompare(b.questionCode ?? "", undefined, { numeric: true }) ||
          a.id.localeCompare(b.id, undefined, { numeric: true }),
      ),
    [observations, summaries],
  );

  // Selects offer only what the data holds.
  const options = useMemo(() => {
    const quarters = [...new Set(rows.map((r) => r.quarter))].sort().reverse();
    const subs = new Set(rows.map((r) => r.subRegionId));
    const cons = new Map(rows.map((r) => [r.contractorId, r.contractorName]));
    const areas = new Set(rows.map((r) => r.area));
    return {
      quarters,
      subRegions: subRegions.filter((s) => subs.has(s.id)),
      contractors: [...cons].sort((a, b) => a[1].localeCompare(b[1])),
      areas: AREAS.filter((a) => areas.has(a.code)),
    };
  }, [rows, subRegions]);

  const matches = useMemo(() => filterLog(rows, filter), [rows, filter]);
  const counts = useMemo(() => causeCounts(matches), [matches]);

  const pages = Math.max(1, Math.ceil(matches.length / PAGE));
  const at = Math.min(page, pages - 1);
  const shown = matches.slice(at * PAGE, at * PAGE + PAGE);

  // A back/forward step that empties the URL should empty the box too.
  useEffect(() => {
    if (!search.toString()) setQ("");
  }, [search]);

  const sel = (
    label: string,
    value: string | undefined,
    onChange: (v: string | undefined) => void,
    all: string,
    opts: { value: string; label: string }[],
  ) => (
    <label className="field" style={{ marginBottom: 0 }}>
      <span>{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{all}</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="stack">
      <AnalysisTabs />
      <div className="filter-row obs-filters">
        <label className="field obs-search" style={{ marginBottom: 0 }}>
          <span>Search</span>
          <input
            id="log-q"
            type="text"
            placeholder="Search observations"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              change({ q: e.target.value });
            }}
          />
        </label>
        {sel("Quarter", filter.quarter, (v) => change({ quarter: v }), "All", options.quarters.map((v) => ({ value: v, label: quarterLabel(v) })))}
        {sel("Sub-region", filter.subRegionId, (v) => change({ subRegionId: v }), "All", options.subRegions.map((s) => ({ value: s.id, label: s.name })))}
        {sel("Contractor", filter.contractorId, (v) => change({ contractorId: v }), "All", options.contractors.map(([id, label]) => ({ value: id, label })))}
        {sel("Area", filter.area, (v) => change({ area: v }), "All", options.areas.map((a) => ({ value: a.code, label: `${a.code} ${a.title}` })))}
        {sel("Cause", filter.cause, (v) => change({ cause: v as LogFilter["cause"] }), "All", GAP_CATEGORIES.map((c) => ({ value: c.code, label: `${c.code} ${c.label}` })))}
        {sel("Kind", filter.kind, (v) => change({ kind: v as LogFilter["kind"] }), "All", [...KIND_OPTIONS])}
        <div className="track-toggle">
          <button
            type="button"
            aria-pressed={!!filter.needsCause}
            onClick={() => change({ needsCause: filter.needsCause ? undefined : true })}
          >
            Needs a cause
          </button>
        </div>
      </div>

      {error ? (
        <div className="obs-error" role="alert">
          <span>The observation log did not load.</span>
          <button type="button" className="ghost" onClick={retry}>
            Retry
          </button>
        </div>
      ) : !ready ? (
        <ul className="obs-list" aria-busy="true" aria-label="Loading observations">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="obs-row obs-skel" aria-hidden />
          ))}
        </ul>
      ) : matches.length > 0 ? (
        <>
          <section className="card obs-summary">
            <div className="obs-count">
              <b>{matches.length}</b>
              <span>{matches.length === 1 ? "observation" : "observations"}</span>
            </div>
            <CauseChart
              counts={counts}
              active={filter.cause}
              onPick={(cause) => change({ cause })}
            />
          </section>
          <ul className="obs-list">
            {shown.map((r) => (
              <ObservationRow
                key={r.id}
                row={r}
                canWrite={canWrite}
                onSetCauses={setObservationCauses}
                onReset={resetObservationCauses}
              />
            ))}
          </ul>
          {pages > 1 && (
            <nav className="obs-pager" aria-label="Pages">
              <button type="button" className="ghost" disabled={at === 0} onClick={() => setPage(at - 1)}>
                Previous
              </button>
              <span>
                {at * PAGE + 1}–{Math.min(matches.length, (at + 1) * PAGE)} of {matches.length}
              </span>
              <button type="button" className="ghost" disabled={at >= pages - 1} onClick={() => setPage(at + 1)}>
                Next
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="obs-count obs-none">
          <b>0</b>
          <span>observations</span>
        </div>
      )}
    </div>
  );
}
