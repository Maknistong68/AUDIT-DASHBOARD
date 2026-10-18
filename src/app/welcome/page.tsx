import { completeOnboarding } from "./actions";
import { audits, contractors, subRegions } from "@/lib/ehss/recorded";

/**
 * The first screen anybody sees, and it was six paragraphs of prose.
 *
 * What makes someone want to go in is the data, so the description is
 * replaced by what is actually on record — counted from the dataset rather
 * than typed into a sentence, so it cannot drift from it the way "13
 * contractors" did the moment a quarter was imported.
 *
 * The two privacy paragraphs stay exactly as written: they are PDPL Art. 12
 * transparency, not copy, and a notice nobody opens is not a notice
 * (docs/COMPLIANCE-KSA.md §5.1).
 */
const FIGURES = [
  { value: contractors.length, label: "contractors" },
  { value: audits.length, label: "reviews" },
  {
    value: new Set(audits.map((a) => a.quarter)).size,
    label: "quarters",
  },
  { value: subRegions.length, label: "sub-regions" },
];

export default function WelcomePage() {
  return (
    <div className="card login-card" style={{ maxWidth: 460 }}>
      <h2>Welcome to the Audit Dashboard</h2>
      <p className="sub">
        EHSS quarterly audit scoring for Oxagon contractors
      </p>
      <ul className="wel-figs">
        {FIGURES.map((f) => (
          <li key={f.label}>
            <strong>{f.value}</strong>
            <em>{f.label}</em>
          </li>
        ))}
      </ul>
      <form action={completeOnboarding}>
        <label className="field">
          <span>
            Display name{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400 }}>
              optional
            </span>
          </span>
          <input
            name="name"
            type="text"
            placeholder="Guest"
            maxLength={80}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Sign in as</span>
          <select name="role" defaultValue="auditor">
            <option value="auditor">Auditor — record and score reviews</option>
            <option value="admin">Admin — plus the reference screens</option>
            <option value="viewer">Viewer — read-only dashboards</option>
          </select>
        </label>
        <button className="primary" type="submit">
          Enter dashboard
        </button>
      </form>
      {/* PDPL Art. 12 transparency: say what the one piece of personal data
          the app touches is used for, and how to erase it. Kept on the page
          itself rather than behind a link — a notice nobody opens is not a
          notice. See docs/COMPLIANCE-KSA.md §5.1. */}
      <p className="sub" style={{ marginTop: 18, marginBottom: 0 }}>
        <strong>Your privacy.</strong> The name is optional and is only used
        to label this session — initials or a job title work fine. It stays
        in a cookie in this browser and is never sent to a server, never
        stored in any audit record, and never shared. <strong>Sign out</strong>,
        in the header, erases it.
      </p>
      <p className="sub" style={{ marginTop: 10, marginBottom: 0 }}>
        The audits themselves hold contractor-level results only — no worker
        records, names, ID numbers, salaries or photographs.
      </p>
    </div>
  );
}
