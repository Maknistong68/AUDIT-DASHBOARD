import { readDemoProfile } from "@/lib/demo/profile";
import { ContractorsClient } from "./ContractorsClient";

export const dynamic = "force-dynamic";

export default async function ContractorsPage() {
  const profile = await readDemoProfile();
  const canManage = profile?.role === "admin" || profile?.role === "auditor";
  return <ContractorsClient canManage={canManage} />;
}
