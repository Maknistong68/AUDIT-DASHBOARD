"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Advance a corrective action on a finalized audit. Permission (the audit's
 * own auditor or an admin) is enforced by public.update_corrective_action. */
export async function updateCorrectiveAction(
  formData: FormData,
): Promise<void> {
  const auditId = String(formData.get("audit_id") ?? "");
  const questionId = String(formData.get("question_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const showAll = String(formData.get("all") ?? "") === "1";
  const backPath = showAll ? "/actions-queue?all=1" : "/actions-queue";
  const fail = (message: string): never =>
    redirect(
      `${backPath}${showAll ? "&" : "?"}error=${encodeURIComponent(message)}`,
    );

  if (!["open", "in_progress", "closed", "verified"].includes(status)) {
    fail("Unknown corrective-action status.");
  }

  const supabase = await createClient();
  const { data: response } = await supabase
    .from("audit_responses")
    .select("id")
    .eq("audit_id", auditId)
    .eq("question_id", questionId)
    .maybeSingle();

  if (!response) fail("Response not found.");

  const { error } = await supabase.rpc("update_corrective_action", {
    p_response_id: (response as { id: string }).id,
    p_status: status,
  });

  if (error) {
    fail(
      "Update failed — only the audit's auditor or an admin can advance corrective actions.",
    );
  }

  revalidatePath("/actions-queue");
  redirect(backPath);
}
