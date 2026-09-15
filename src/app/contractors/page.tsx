import Link from "next/link";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { SetupNotice } from "@/components/SetupNotice";
import { ScoreMeter } from "@/components/ScoreMeter";
import { formatDate } from "@/lib/format";
import type { ContractorLatestScoreRow, ContractorRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ContractorsPage() {
  if (!hasSupabaseEnv()) return <SetupNotice />;

  const supabase = await createClient();
  const [contractorsRes, latestRes] = await Promise.all([
    supabase.from("contractors").select("*").eq("active", true).order("name"),
    supabase.from("v_contractor_latest_scores").select("*"),
  ]);

  const contractors = (contractorsRes.data ?? []) as ContractorRow[];
  const latest = (latestRes.data ?? []) as ContractorLatestScoreRow[];
  const byContractor = new Map<string, ContractorLatestScoreRow[]>();
  for (const l of latest) {
    const list = byContractor.get(l.contractor_id) ?? [];
    list.push(l);
    byContractor.set(l.contractor_id, list);
  }

  return (
    <section className="card">
      <h2>Contractors</h2>
      <p className="sub">Latest finalized score per audit type</p>
      {contractors.length === 0 ? (
        <div className="chart-empty">
          No contractors yet — an admin adds them in the database (or a future
          admin screen).
        </div>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Code</th>
              <th>Contractor</th>
              <th>Audit type</th>
              <th>Latest audit</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((c) => {
              const rows = byContractor.get(c.id);
              if (!rows || rows.length === 0) {
                return (
                  <tr key={c.id}>
                    <td>{c.code}</td>
                    <td>
                      <Link href={`/contractors/${c.id}`}>{c.name}</Link>
                    </td>
                    <td colSpan={3} style={{ color: "var(--muted)" }}>
                      No finalized audits yet
                    </td>
                  </tr>
                );
              }
              return rows.map((l, i) => (
                <tr key={`${c.id}-${l.audit_type_id}`}>
                  <td>{i === 0 ? c.code : ""}</td>
                  <td>
                    {i === 0 ? (
                      <Link href={`/contractors/${c.id}`}>{c.name}</Link>
                    ) : (
                      ""
                    )}
                  </td>
                  <td>{l.audit_type_name}</td>
                  <td>{formatDate(l.latest_audit_date)}</td>
                  <td>
                    <ScoreMeter score={l.latest_score} />
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
