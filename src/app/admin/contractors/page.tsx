import { createClient } from "@/lib/supabase/server";
import { AdminError } from "@/components/AdminError";
import { addContractor, setContractorActive } from "../actions";
import type { ContractorRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminContractorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("contractors")
    .select("*")
    .order("name");
  const contractors = (data ?? []) as ContractorRow[];

  return (
    <div className="stack">
      <section className="card">
        <h2>Contractors</h2>
        <p className="sub">
          Organizational names only — never a person. Deactivating hides a
          contractor from new audits; history is kept.
        </p>
        <AdminError error={error} />
        {contractors.length === 0 ? (
          <div className="chart-empty">No contractors yet.</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contractors.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.code}</strong>
                  </td>
                  <td>{c.name}</td>
                  <td style={{ color: c.active ? undefined : "var(--muted)" }}>
                    {c.active ? "Active" : "Inactive"}
                  </td>
                  <td className="num">
                    <form action={setContractorActive}>
                      <input type="hidden" name="id" value={c.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={String(!c.active)}
                      />
                      <button className="ghost" type="submit">
                        {c.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" style={{ maxWidth: 480 }}>
        <h2>Add contractor</h2>
        <form action={addContractor}>
          <label className="field">
            <span>Code</span>
            <input name="code" type="text" required placeholder="ABC" />
          </label>
          <label className="field">
            <span>Name</span>
            <input
              name="name"
              type="text"
              required
              placeholder="ABC Contracting"
            />
          </label>
          <button className="primary" type="submit">
            Add contractor
          </button>
        </form>
      </section>
    </div>
  );
}
