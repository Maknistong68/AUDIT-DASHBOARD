import { completeOnboarding } from "./actions";

export default function WelcomePage() {
  return (
    <div className="card login-card" style={{ maxWidth: 420 }}>
      <h2>Welcome to the Audit Dashboard</h2>
      <p className="sub">
        Contractor audit scoring and compliance-trend analytics. This demo
        runs on built-in sample data — three contractors, six audits, live
        dashboards. Pick a name and a role to look around; nothing is stored
        beyond your browser.
      </p>
      <form action={completeOnboarding}>
        <label className="field">
          <span>Your name</span>
          <input name="name" type="text" placeholder="Guest" maxLength={80} />
        </label>
        <label className="field">
          <span>Explore as</span>
          <select name="role" defaultValue="auditor">
            <option value="auditor">Auditor — score audits, track actions</option>
            <option value="admin">Admin — plus reference-data screens</option>
            <option value="viewer">Viewer — read-only dashboards</option>
          </select>
        </label>
        <button className="primary" type="submit">
          Enter dashboard
        </button>
      </form>
    </div>
  );
}
