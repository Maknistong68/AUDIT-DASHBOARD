import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/mode";
import { NewAuditForm } from "./NewAuditForm";
import type { AuditTypeRow, ContractorRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewAuditPage() {
  if (isDemoMode()) {
    return (
      <section className="card" style={{ maxWidth: 480 }}>
        <h2>New audit</h2>
        <p className="sub">
          Creating audits needs the database and is disabled in the demo — but
          you can try the scoring form on the{" "}
          <Link href="/audits/a7">draft audit</Link>.
        </p>
      </section>
    );
  }

  const supabase = await createClient();
  const [contractorsRes, typesRes] = await Promise.all([
    supabase.from("contractors").select("*").eq("active", true).order("name"),
    supabase.from("audit_types").select("*").eq("active", true).order("name"),
  ]);

  return (
    <section className="card" style={{ maxWidth: 480 }}>
      <h2>New audit</h2>
      <p className="sub">Creates a draft only you (and admins) can see.</p>
      <NewAuditForm
        contractors={(contractorsRes.data ?? []) as ContractorRow[]}
        auditTypes={(typesRes.data ?? []) as AuditTypeRow[]}
      />
    </section>
  );
}
