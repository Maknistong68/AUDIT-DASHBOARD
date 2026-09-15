import { notFound } from "next/navigation";
import { StatTile } from "@/components/StatTile";
import { ScoreMeter } from "@/components/ScoreMeter";
import { TrendChart } from "@/components/charts/TrendChart";
import { ParetoBars } from "@/components/charts/ParetoBars";
import { AuditStatusBadge, CorrectiveActionBadge } from "@/components/Badges";
import { AuditEntryForm } from "../audits/[id]/AuditEntryForm";
import type {
  AuditQuestionRow,
  AuditResponseRow,
  NcCategoryRow,
} from "@/lib/db";

/**
 * Dev-only component gallery with sample data, so the dashboard pieces can be
 * seen and styled without a Supabase instance. Not built in production.
 */
export default function DemoPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const trend = [
    { label: "Apr 2026", value: 62 },
    { label: "May 2026", value: 66.5 },
    { label: "Jun 2026", value: 64 },
    { label: "Jul 2026", value: 73 },
    { label: "Aug 2026", value: 78 },
    { label: "Sep 2026", value: 91 },
  ];

  const pareto = [
    { label: "Incomplete Documentation / Missing Requirements", count: 14, share: 38.9 },
    { label: "Documentation Available but Not Approved", count: 9, share: 25 },
    { label: "Not Implemented", count: 6, share: 16.7 },
    { label: "Partially Implemented", count: 4, share: 11.1 },
    { label: "Documentation Not Available", count: 3, share: 8.3 },
  ];

  const questions: AuditQuestionRow[] = [
    {
      id: "q1",
      audit_type_id: "t1",
      code: "WMP-01",
      category: "Worker Management Plan",
      question:
        "Worker Management Plan is established and implemented in accordance with applicable requirements.",
      weight: 1,
      sort_order: 10,
      active: true,
    },
    {
      id: "q2",
      audit_type_id: "t1",
      code: "WMP-02",
      category: "Worker Management Plan",
      question:
        "Worker Management Plan is reviewed and updated at the required frequency and re-approved after changes.",
      weight: 1,
      sort_order: 20,
      active: true,
    },
    {
      id: "q3",
      audit_type_id: "t1",
      code: "ACC-01",
      category: "Accommodation",
      question:
        "Worker accommodation is provided and maintained in accordance with applicable standards.",
      weight: 1,
      sort_order: 30,
      active: true,
    },
  ];

  const responses: AuditResponseRow[] = [
    {
      id: "r1",
      audit_id: "a1",
      question_id: "q1",
      result: "full_compliance",
      nc_category_id: null,
      observation: "positive_practice",
      corrective_action_status: null,
    },
    {
      id: "r2",
      audit_id: "a1",
      question_id: "q2",
      result: "non_compliance",
      nc_category_id: "nc2",
      observation: null,
      corrective_action_status: "open",
    },
  ];

  const ncCategories: NcCategoryRow[] = [
    { id: "nc1", code: "NC-NAV", name: "Documentation Not Available", description: null, sort_order: 10, active: true },
    { id: "nc2", code: "NC-NAP", name: "Documentation Available but Not Approved", description: null, sort_order: 20, active: true },
    { id: "nc3", code: "NC-INC", name: "Incomplete Documentation / Missing Requirements", description: null, sort_order: 30, active: true },
  ];

  return (
    <div className="stack">
      <div className="notice">
        Component gallery with sample data — development only.
      </div>

      <div className="kpi-row">
        <StatTile label="Program average score" value="78.4%" hint="mean of each contractor's latest audit" />
        <StatTile label="Finalized audits" value="24" />
        <StatTile label="Contractors audited" value="7" />
        <StatTile label="Open corrective actions" value="11" hint="open or in progress" />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Average score by month</h2>
          <p className="sub">All contractors, finalized audits</p>
          <TrendChart points={trend} />
        </section>
        <section className="card">
          <h2>Non-compliance causes</h2>
          <p className="sub">All NCs by classification</p>
          <ParetoBars data={pareto} />
        </section>
      </div>

      <section className="card">
        <h2>Meters &amp; badges</h2>
        <p className="sub">Score meters, audit status, corrective actions</p>
        <table className="data">
          <tbody>
            <tr>
              <td>ABC Contracting</td>
              <td><ScoreMeter score={91} /></td>
              <td><AuditStatusBadge status="approved" /></td>
              <td><CorrectiveActionBadge status="open" /></td>
            </tr>
            <tr>
              <td>XYZ Industrial</td>
              <td><ScoreMeter score={62.5} /></td>
              <td><AuditStatusBadge status="submitted" /></td>
              <td><CorrectiveActionBadge status="in_progress" /></td>
            </tr>
            <tr>
              <td>Delta Services</td>
              <td><ScoreMeter score={null} /></td>
              <td><AuditStatusBadge status="draft" /></td>
              <td><CorrectiveActionBadge status="verified" /></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>ABC Contracting — Welfare Management Audit</h2>
        <p className="sub">Entry form (sample, saves will fail without Supabase)</p>
        <AuditEntryForm
          auditId="a1"
          auditStatus="draft"
          canEdit
          isAdmin={false}
          questions={questions}
          responses={responses}
          ncCategories={ncCategories}
        />
      </section>
    </div>
  );
}
