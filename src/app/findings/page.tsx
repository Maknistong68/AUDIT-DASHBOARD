import { audits, contractors, subRegions } from "@/lib/ehss/mock";
import { collectObservations } from "@/lib/ehss/summaries";
import { FindingsClient } from "./FindingsClient";

export const dynamic = "force-dynamic";

export default function FindingsPage() {
  const observations = collectObservations(audits, contractors);
  return (
    <FindingsClient
      subRegions={subRegions}
      contractors={contractors}
      observations={observations}
    />
  );
}
