import { CHECKLIST } from "@/lib/ehss/checklist";
import { OBSERVATION_OPTIONS, RATING_BANDS } from "@/lib/ehss/model";
import { contractors, subRegions } from "@/lib/ehss/mock";
import { readDemoProfile } from "@/lib/demo/profile";

export const dynamic = "force-dynamic";

/** Reference view: the checklist, scoring rules, observation taxonomy and
 * contractor register behind the audits. Management screens return when the
 * app is connected to a database. */
export default async function AdminPage() {
  const profile = await readDemoProfile();
  if (profile?.role !== "admin") {
    return (
      <div className="card">
        <h2>Admins only</h2>
        <p className="sub">
          This section holds the checklist and scoring reference. Choose the
          Admin role on the welcome screen to view it.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="notice">
        Reference data behind the audits. Editing (question weights,
        contractors, users) is enabled once the app is connected to a
        database.
      </div>

      <section className="card">
        <h2>Scoring &amp; rating</h2>
        <p className="sub">
          Points = weight × (Full 100% · Partial 50% · No 0%); N/A is excluded
          from the calculation. Sub-section = points ÷ applicable weight;
          section = mean of sub-sections; total = mean of sections.
        </p>
        <table className="data" style={{ maxWidth: 420 }}>
          <tbody>
            {RATING_BANDS.map((b, i) => (
              <tr key={b.label}>
                <td>{b.label}</td>
                <td className="num">
                  {i === 0 ? `${b.min}–100%` : `${b.min}–${RATING_BANDS[i - 1]!.min - 1}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Observation classifications</h2>
        <p className="sub">
          The pre-made options recorded per question instead of free text —
          OB2–OB5 are required on every Partial or No answer.
        </p>
        <table className="data">
          <tbody>
            {OBSERVATION_OPTIONS.map((o) => (
              <tr key={o.code}>
                <td>
                  <strong>{o.code}</strong>
                </td>
                <td>{o.label}</td>
                <td style={{ color: "var(--ink-2)" }}>{o.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Contractor register</h2>
        <table className="data">
          <thead>
            <tr>
              <th>Code</th>
              <th>Contractor</th>
              <th>Sub-region</th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.code}</strong>
                </td>
                <td>{c.name}</td>
                <td>{subRegions.find((s) => s.id === c.subRegionId)?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Checklist</h2>
        <p className="sub">
          81 questions from the EHSS Quarterly Performance Review workbook
        </p>
        {CHECKLIST.map((section) => (
          <div key={section.code}>
            <div className="q-category">
              {section.code}. {section.title}
            </div>
            <table className="data">
              <tbody>
                {section.subSections.flatMap((ss) =>
                  ss.questions.map((q) => (
                    <tr key={q.code}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <strong>{q.code}</strong>
                      </td>
                      <td style={{ color: "var(--ink-2)" }}>{q.text}</td>
                      <td className="num">w{q.weight}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </div>
  );
}
