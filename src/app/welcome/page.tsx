import { completeOnboarding } from "./actions";

export default function WelcomePage() {
  return (
    <div className="card login-card" style={{ maxWidth: 460 }}>
      <h2>Welcome to the Audit Dashboard</h2>
      <p className="sub">
        EHSS quarterly scoring and trend analytics for Oxagon contractors.
        This demo runs on built-in sample data — 11 contractors across two
        sub-regions, four quarters of reviews. Choose a role to look around.
      </p>
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
          <span>Explore as</span>
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
        stored in any audit record, and never shared. Reviews you create are
        saved in this browser only. <strong>Restart demo</strong>, in the
        header, erases both.
      </p>
      <p className="sub" style={{ marginTop: 10, marginBottom: 0 }}>
        The audits themselves hold contractor-level results only — no worker
        records, names, ID numbers, salaries or photographs.
      </p>
    </div>
  );
}
