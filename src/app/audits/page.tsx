import { readDemoProfile } from "@/lib/demo/profile";
import { AuditsClient } from "./AuditsClient";

export const dynamic = "force-dynamic";

export default async function AuditsPage() {
  const profile = await readDemoProfile();
  const canCreate = profile?.role === "admin" || profile?.role === "auditor";
  return <AuditsClient canCreate={canCreate} />;
}
