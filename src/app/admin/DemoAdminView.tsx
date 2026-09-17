import {
  demoContractors,
  demoNcCategories,
  demoQuestions,
} from "@/lib/demo/data";

/** Read-only stand-in for the admin section in demo mode: shows the
 * reference data the real screens manage. */
export function DemoAdminView() {
  return (
    <div className="stack">
      <div className="notice">
        Demo mode — these screens manage the database (add contractors and
        questions, adjust weights, assign roles). Management is enabled once
        the app is connected to Supabase; below is the reference data behind
        this demo.
      </div>

      <section className="card">
        <h2>Contractors</h2>
        <table className="data">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            {demoContractors.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.code}</strong>
                </td>
                <td>{c.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>NC classifications</h2>
        <table className="data">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {demoNcCategories.map((n) => (
              <tr key={n.id}>
                <td>
                  <strong>{n.code}</strong>
                </td>
                <td>{n.name}</td>
                <td style={{ color: "var(--ink-2)" }}>{n.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Audit questions — Welfare Management Audit</h2>
        <table className="data">
          <thead>
            <tr>
              <th>Code</th>
              <th>Category</th>
              <th>Control</th>
              <th className="num">Weight</th>
            </tr>
          </thead>
          <tbody>
            {demoQuestions.map((q) => (
              <tr key={q.id}>
                <td>
                  <strong>{q.code}</strong>
                </td>
                <td>{q.category}</td>
                <td style={{ color: "var(--ink-2)" }}>{q.question}</td>
                <td className="num">{q.weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
