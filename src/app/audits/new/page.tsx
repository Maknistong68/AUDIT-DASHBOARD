import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { SetupNotice } from "@/components/SetupNotice";
import { NewAuditForm } from "./NewAuditForm";
import type { AuditTypeRow, ContractorRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewAuditPage() {
  if (!hasSupabaseEnv()) return <SetupNotice />;

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
