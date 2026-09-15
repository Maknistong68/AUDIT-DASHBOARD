import { createClient } from "@/lib/supabase/server";
import { AdminError } from "@/components/AdminError";
import { addNcCategory, setNcCategoryActive } from "../actions";
import type { NcCategoryRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminNcCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("nc_categories")
    .select("*")
    .order("sort_order");
  const categories = (data ?? []) as NcCategoryRow[];

  return (
    <div className="stack">
      <section className="card">
        <h2>NC classifications</h2>
        <p className="sub">
          The controlled taxonomy auditors pick from. Prefer promoting a
          recurring &ldquo;Other&rdquo; use to its own classification over free
          text. Deactivating hides a classification from new entries; history
          is kept.
        </p>
        <AdminError error={error} />
        <table className="data">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Meaning</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.code}</strong>
                </td>
                <td>{c.name}</td>
                <td style={{ color: "var(--ink-2)" }}>{c.description}</td>
                <td style={{ color: c.active ? undefined : "var(--muted)" }}>
                  {c.active ? "Active" : "Inactive"}
                </td>
                <td className="num">
                  <form action={setNcCategoryActive}>
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
      </section>

      <section className="card" style={{ maxWidth: 520 }}>
        <h2>Add classification</h2>
        <form action={addNcCategory}>
          <label className="field">
            <span>Code</span>
            <input name="code" type="text" required placeholder="NC-XXX" />
          </label>
          <label className="field">
            <span>Name</span>
            <input name="name" type="text" required />
          </label>
          <label className="field">
            <span>Meaning</span>
            <input
              name="description"
              type="text"
              placeholder="What this classification covers"
            />
          </label>
          <label className="field">
            <span>Sort order</span>
            <input name="sort_order" type="number" defaultValue={100} />
          </label>
          <button className="primary" type="submit">
            Add classification
          </button>
        </form>
      </section>
    </div>
  );
}
