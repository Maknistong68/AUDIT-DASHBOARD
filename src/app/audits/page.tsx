import Link from "next/link";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { SetupNotice } from "@/components/SetupNotice";
import { AuditStatusBadge } from "@/components/Badges";
import { formatDate, formatScore } from "@/lib/format";
import type { AuditStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface AuditListRow {
  id: string;
  audit_date: string;
  status: AuditStatus;
  score: number | null;
  contractors: { name: string } | null;
  audit_types: { name: string } | null;
}

export default async function AuditsPage() {
  if (!hasSupabaseEnv()) return <SetupNotice />;

  const supabase = await createClient();

  const [auditsRes, profileRes] = await Promise.all([
    supabase
      .from("audits")
      .select(
        "id, audit_date, status, score, contractors(name), audit_types(name)",
      )
      .order("audit_date", { ascending: false }),
    supabase.auth.getUser().then(async ({ data: { user } }) =>
      user
        ? await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single()
        : { data: null },
    ),
  ]);

  const audits = (auditsRes.data ?? []) as unknown as AuditListRow[];
  const role = (profileRes.data as { role: string } | null)?.role ?? "viewer";
  const canCreate = role === "auditor" || role === "admin";

  return (
    <section className="card">
      <h2>Audits</h2>
      <p className="sub">
        Drafts are visible only to their auditor and admins.
      </p>
      {canCreate && (
        <p>
          <Link href="/audits/new">
            <button className="primary" type="button">
              New audit
            </button>
          </Link>
        </p>
      )}
      {audits.length === 0 ? (
        <div className="chart-empty">No audits yet.</div>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Contractor</th>
              <th>Audit type</th>
              <th>Status</th>
              <th className="num">Score</th>
            </tr>
          </thead>
          <tbody>
            {audits.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/audits/${a.id}`}>{formatDate(a.audit_date)}</Link>
                </td>
                <td>{a.contractors?.name ?? "—"}</td>
                <td>{a.audit_types?.name ?? "—"}</td>
                <td>
                  <AuditStatusBadge status={a.status} />
                </td>
                <td className="num">{formatScore(a.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
