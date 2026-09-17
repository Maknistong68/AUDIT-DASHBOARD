import Link from "next/link";
import { getCurrentUser, getNcBreakdown, getOwnedAuditIds } from "@/lib/data";
import { isDemoMode } from "@/lib/demo/mode";
import { AdminError } from "@/components/AdminError";
import { CorrectiveActionBadge } from "@/components/Badges";
import { CORRECTIVE_ACTION_LABELS, formatDate } from "@/lib/format";
import { updateCorrectiveAction } from "./actions";
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
  const { error, all } = await searchParams;
  const showAll = all === "1";
  const demo = isDemoMode();

  const [allRows, user] = await Promise.all([
    getNcBreakdown(),
    getCurrentUser(),
  ]);
  const ownAudits = user
    ? await getOwnedAuditIds(user.id)
    : new Set<string>();
  const isAdmin = user?.role === "admin";

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
        {demo
          ? "Follow-up on non-compliances from finalized audits (read-only in the demo)."
          : "Follow-up on non-compliances from finalized audits. The audit's auditor and admins can advance the status here; the underlying audit stays locked."}
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
              const canEdit =
                !demo && (isAdmin || ownAudits.has(r.audit_id));
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
