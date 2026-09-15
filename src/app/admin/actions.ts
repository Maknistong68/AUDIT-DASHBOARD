"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin mutations for reference data and user roles. RLS is the real gate
 * (admin-only write policies); these actions just pass writes through and
 * surface failures back on the page via an ?error= query param.
 */

function back(path: string, error?: string): never {
  redirect(error ? `${path}?error=${encodeURIComponent(error)}` : path);
}

export async function addContractor(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!code || !name) back("/admin/contractors", "Code and name are required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("contractors")
    .insert({ code, name });
  if (error) {
    back(
      "/admin/contractors",
      "Could not add the contractor — the code and name must be unique, and admin role is required.",
    );
  }
  revalidatePath("/admin/contractors");
  back("/admin/contractors");
}

export async function setContractorActive(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("contractors")
    .update({ active })
    .eq("id", id);
  if (error) back("/admin/contractors", "Update failed (admin role required).");
  revalidatePath("/admin/contractors");
  back("/admin/contractors");
}

export async function addNcCategory(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const sortOrder = Number(formData.get("sort_order") ?? 0);
  if (!code || !name)
    back("/admin/nc-categories", "Code and name are required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("nc_categories")
    .insert({ code, name, description, sort_order: sortOrder });
  if (error) {
    back(
      "/admin/nc-categories",
      "Could not add the classification — the code and name must be unique, and admin role is required.",
    );
  }
  revalidatePath("/admin/nc-categories");
  back("/admin/nc-categories");
}

export async function setNcCategoryActive(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("nc_categories")
    .update({ active })
    .eq("id", id);
  if (error)
    back("/admin/nc-categories", "Update failed (admin role required).");
  revalidatePath("/admin/nc-categories");
  back("/admin/nc-categories");
}

export async function addQuestion(formData: FormData): Promise<void> {
  const auditTypeId = String(formData.get("audit_type_id") ?? "");
  const path = `/admin/questions?type=${auditTypeId}`;
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const category = String(formData.get("category") ?? "").trim();
  const question = String(formData.get("question") ?? "").trim();
  const weight = Number(formData.get("weight") ?? 1);
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  if (!auditTypeId || !code || !category || !question) {
    back(path, "Code, category and control text are all required.");
  }
  if (!(weight > 0)) back(path, "Weight must be greater than zero.");

  const supabase = await createClient();
  const { error } = await supabase.from("audit_questions").insert({
    audit_type_id: auditTypeId,
    code,
    category,
    question,
    weight,
    sort_order: sortOrder,
  });
  if (error) {
    back(
      path,
      "Could not add the question — the code must be unique within the audit type, and admin role is required.",
    );
  }
  revalidatePath("/admin/questions");
  back(path);
}

export async function updateQuestion(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const auditTypeId = String(formData.get("audit_type_id") ?? "");
  const path = `/admin/questions?type=${auditTypeId}`;
  const weight = Number(formData.get("weight") ?? 1);
  const active = formData.get("active") === "on";
  if (!(weight > 0)) back(path, "Weight must be greater than zero.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("audit_questions")
    .update({ weight, active })
    .eq("id", id);
  if (error) back(path, "Update failed (admin role required).");
  revalidatePath("/admin/questions");
  back(path);
}

export async function setUserRole(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!["admin", "auditor", "viewer"].includes(role)) {
    back("/admin/users", "Unknown role.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id === id && role !== "admin") {
    back(
      "/admin/users",
      "You cannot remove your own admin role — ask another admin.",
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", id);
  if (error) back("/admin/users", "Update failed (admin role required).");
  revalidatePath("/admin/users");
  back("/admin/users");
}
