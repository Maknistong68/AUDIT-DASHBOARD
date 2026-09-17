"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/mode";
import type {
  AuditResult,
  CorrectiveActionStatus,
  ObservationType,
} from "@/lib/types";

export interface ActionState {
  error: string | null;
  savedAt?: number;
}

const DEMO_ERROR: ActionState = {
  error: "Demo mode — changes aren't saved.",
};

export async function createAudit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (isDemoMode()) return DEMO_ERROR;
  const contractorId = String(formData.get("contractor_id") ?? "");
  const auditTypeId = String(formData.get("audit_type_id") ?? "");
  const auditDate = String(formData.get("audit_date") ?? "");

  if (!contractorId || !auditTypeId || !auditDate) {
    return { error: "Contractor, audit type and date are all required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("audits")
    .insert({
      contractor_id: contractorId,
      audit_type_id: auditTypeId,
      audit_date: auditDate,
      auditor_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      error:
        "Could not create the audit. Auditor or admin role is required to create audits.",
    };
  }

  redirect(`/audits/${data.id}`);
}

export interface ResponseInput {
  questionId: string;
  result: AuditResult;
  ncCategoryId: string | null;
  observation: ObservationType | null;
  correctiveActionStatus: CorrectiveActionStatus | null;
}

export async function saveResponses(
  auditId: string,
  responses: ResponseInput[],
): Promise<ActionState> {
  if (isDemoMode()) return DEMO_ERROR;
  if (responses.length === 0) {
    return { error: "Nothing to save yet — set a result on at least one question." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("audit_responses").upsert(
    responses.map((r) => ({
      audit_id: auditId,
      question_id: r.questionId,
      result: r.result,
      nc_category_id: r.result === "non_compliance" ? r.ncCategoryId : null,
      observation: r.observation,
      corrective_action_status:
        r.result === "non_compliance" ? r.correctiveActionStatus : null,
    })),
    { onConflict: "audit_id,question_id" },
  );

  if (error) {
    return {
      error:
        "Save failed. Check that every Non-Compliance has a classification and that this audit is still an editable draft.",
    };
  }

  revalidatePath(`/audits/${auditId}`);
  return { error: null, savedAt: Date.now() };
}

export async function submitAudit(auditId: string): Promise<ActionState> {
  if (isDemoMode()) return DEMO_ERROR;
  const supabase = await createClient();

  const [auditRes, questionCountRes, responseCountRes] = await Promise.all([
    supabase
      .from("audits")
      .select("id, audit_type_id, status")
      .eq("id", auditId)
      .maybeSingle(),
    supabase
      .from("audit_questions")
      .select("id, audit_type_id, active"),
    supabase
      .from("audit_responses")
      .select("id", { count: "exact", head: true })
      .eq("audit_id", auditId),
  ]);

  const audit = auditRes.data;
  if (!audit) return { error: "Audit not found." };

  const activeQuestions = (questionCountRes.data ?? []).filter(
    (q) => q.audit_type_id === audit.audit_type_id && q.active,
  ).length;
  const answered = responseCountRes.count ?? 0;

  if (answered < activeQuestions) {
    return {
      error: `Answer all questions before submitting (${answered} of ${activeQuestions} answered).`,
    };
  }

  const { error } = await supabase
    .from("audits")
    .update({ status: "submitted" })
    .eq("id", auditId);

  if (error) return { error: "Submit failed." };

  revalidatePath(`/audits/${auditId}`);
  revalidatePath("/audits");
  return { error: null, savedAt: Date.now() };
}

export async function approveAudit(auditId: string): Promise<ActionState> {
  if (isDemoMode()) return DEMO_ERROR;
  const supabase = await createClient();
  const { error } = await supabase
    .from("audits")
    .update({ status: "approved" })
    .eq("id", auditId)
    .eq("status", "submitted");

  if (error) return { error: "Approve failed (admin role required)." };

  revalidatePath(`/audits/${auditId}`);
  revalidatePath("/audits");
  return { error: null, savedAt: Date.now() };
}

export async function deleteAudit(auditId: string): Promise<ActionState> {
  if (isDemoMode()) return DEMO_ERROR;
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("audits")
    .delete({ count: "exact" })
    .eq("id", auditId);

  if (error || !count) {
    return { error: "Delete failed. Only draft audits you own can be deleted." };
  }
  redirect("/audits");
}
