import Link from "next/link";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { SetupNotice } from "@/components/SetupNotice";
import { AdminError } from "@/components/AdminError";
import { CorrectiveActionBadge } from "@/components/Badges";
import { CORRECTIVE_ACTION_LABELS, formatDate } from "@/lib/format";
import { updateCorrectiveAction } from "./actions";
import type { NcBreakdownRow } from "@/lib/db";
import type { CorrectiveActionStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES = Object.keys(
  CORRECTIVE_ACTION_LABELS,
) as CorrectiveActionStatus[];

export default async function ActionsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; all?: string }>;
}) {
  if (!hasSupabaseEnv()) return <SetupNotice />;
  const { error, all } = await searchParams;
  const showAll = all === "1";

  const supabase = await createClient();
  const [ncRes, auditsRes, userRes] = await Promise.all([
    supabase.from("v_nc_breakdown").select("*").order("audit_date"),
    supabase.from("audits").select("id, auditor_id"),
    supabase.auth.getUser(),
  ]);

  const userId = userRes.data.user?.id;
  const { data: profileData } = userId
    ? await supabase.from("profiles").select("role").eq("id", userId).single()
    : { data: null };
  const isAdmin = (profileData as { role: string } | null)?.role === "admin";

  const ownAudits = new Set(
    ((auditsRes.data ?? []) as { id: string; auditor_id: string }[])
      .filter((a) => a.auditor_id === userId)
      .map((a) => a.id),
  );

  const allRows = (ncRes.data ?? []) as NcBreakdownRow[];
  const rows = showAll
    ? allRows
    : allRows.filter(
        (r) =>
          r.corrective_action_status === "open" ||
          r.corrective_action_status === "in_progress",
      );

  return (
    <section className="card">
      <h2>Corrective actions</h2>
      <p className="sub">
        Follow-up on non-compliances from finalized audits. The audit&apos;s
        auditor and admins can advance the status here; the underlying audit
        stays locked.
      </p>
      <p>
        {showAll ? (
          <Link href="/actions-queue">Show open only</Link>
        ) : (
          <Link href="/actions-queue?all=1">Show all NCs</Link>
        )}
      </p>
      <AdminError error={error} />
      {rows.length === 0 ? (
        <div className="chart-empty">
          {showAll
            ? "No non-compliances recorded."
            : "No open corrective actions."}
        </div>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Contractor</th>
              <th>Audit</th>
              <th>Control</th>
              <th>Classification</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const canEdit = isAdmin || ownAudits.has(r.audit_id);
              return (
                <tr key={`${r.audit_id}-${r.question_id}`}>
                  <td>
                    <Link href={`/contractors/${r.contractor_id}`}>
                      {r.contractor_name}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/audits/${r.audit_id}`}>
                      {formatDate(r.audit_date)}
                    </Link>
                  </td>
                  <td>
                    <strong>{r.question_code}</strong>{" "}
                    <span style={{ color: "var(--muted)" }}>
                      {r.question_category}
                    </span>
                  </td>
                  <td>{r.nc_category_name}</td>
                  <td>
                    {canEdit ? (
                      <form
                        action={updateCorrectiveAction}
                        style={{
                          display: "inline-flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <input type="hidden" name="audit_id" value={r.audit_id} />
                        <input
                          type="hidden"
                          name="question_id"
                          value={r.question_id}
                        />
                        {showAll && (
                          <input type="hidden" name="all" value="1" />
                        )}
                        <select
                          name="status"
                          defaultValue={r.corrective_action_status ?? "open"}
                          aria-label={`Corrective action for ${r.question_code}`}
                          style={{ width: 140 }}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {CORRECTIVE_ACTION_LABELS[s]}
                            </option>
                          ))}
                        </select>
                        <button className="ghost" type="submit">
                          Save
                        </button>
                      </form>
                    ) : r.corrective_action_status ? (
                      <CorrectiveActionBadge
                        status={r.corrective_action_status}
                      />
                    ) : (
                      <span style={{ color: "var(--muted)" }}>Not started</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
