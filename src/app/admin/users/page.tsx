import { createClient } from "@/lib/supabase/server";
import { AdminError } from "@/components/AdminError";
import { setUserRole } from "../actions";
import type { ProfileRow } from "@/lib/db";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROLES: UserRole[] = ["viewer", "auditor", "admin"];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: userData }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.auth.getUser(),
  ]);
  const profiles = (data ?? []) as ProfileRow[];
  const selfId = userData.user?.id;

  return (
    <section className="card">
      <h2>Users</h2>
      <p className="sub">
        Accounts are created in Supabase Auth (invite or sign-up) and appear
        here automatically as viewers. Auditors can create audits; admins
        manage everything. You cannot remove your own admin role.
      </p>
      <AdminError error={error} />
      {profiles.length === 0 ? (
        <div className="chart-empty">No users yet.</div>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>User ID</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.full_name ?? <span style={{ color: "var(--muted)" }}>—</span>}
                  {p.id === selfId && (
                    <span style={{ color: "var(--muted)" }}> (you)</span>
                  )}
                </td>
                <td style={{ color: "var(--muted)", fontSize: 12 }}>
                  {p.id.slice(0, 8)}…
                </td>
                <td colSpan={2}>
                  <form
                    action={setUserRole}
                    style={{
                      display: "inline-flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <select
                      name="role"
                      defaultValue={p.role}
                      aria-label={`Role for ${p.full_name ?? p.id}`}
                      style={{ width: 130 }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button className="ghost" type="submit">
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
