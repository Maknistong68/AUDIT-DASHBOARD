import { readDemoProfile } from "@/lib/demo/profile";
import { AuditDetailClient } from "./AuditDetailClient";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await readDemoProfile();
  return <AuditDetailClient auditId={id} role={profile?.role ?? null} />;
}
