import { DISCIPLINES } from "@/lib/ehss/disciplines";
import { BASELINE_SETTINGS } from "@/lib/ehss/settings";

/**
 * The programme settings, and why they are not editable yet.
 *
 * The mechanism IS built and tested (`lib/ehss/settings.ts`): settings are
 * versioned by the quarter they take effect, a change cannot be backdated
 * into a quarter that has already been reported, and weights that do not
 * sum to 100% are refused. That ordering was deliberate — the trap is
 * bigger than the feature. If "below target" read one global number,
 * raising the target from 90 to 95 would silently restate every quarter
 * already reported: last quarter's board said four contractors were below
 * target, it now says nine, and nobody changed an audit.
 *
 * What is not done is the wiring: `TARGET_SCORE` is read directly in 53
 * places, and a target that half the screen respects is worse than one
 * nobody can change. So this panel shows the rule in force and says
 * plainly what is missing, rather than offering a control that would only
 * half work.
 */
export function SettingsPanel() {
  return (
    <section className="card">
      <h2>Programme settings</h2>
      <p className="sub">
        The target and the discipline weights in force. Versioned by the
        quarter they take effect, so changing one can never restate a
        quarter that has already been reported.
      </p>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Setting</th>
              <th className="num">In force</th>
              <th>Effective from</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Compliance target</td>
              <td className="num">
                <strong>{BASELINE_SETTINGS.targetScore}%</strong>
              </td>
              <td style={{ color: "var(--muted)" }}>the programme start</td>
            </tr>
            {DISCIPLINES.map((d) => (
              <tr key={d.id}>
                <td>{d.name} weight</td>
                <td className="num">
                  {Math.round(BASELINE_SETTINGS.weights[d.id]! * 100)}%
                </td>
                <td style={{ color: "var(--muted)" }}>the programme start</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sub" style={{ marginTop: 12 }}>
        Editing these needs every screen to read the target for the quarter
        it is showing rather than one global number — a target that half
        the screen respects would be worse than one nobody can change. The
        versioning rules are built and pinned; the migration is the next
        step.
      </p>
    </section>
  );
}
