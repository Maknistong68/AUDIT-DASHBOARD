"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_PROFILE_COOKIE } from "@/lib/demo/profile";

export async function completeOnboarding(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const roleInput = String(formData.get("role") ?? "");
  const role = ["admin", "auditor", "viewer"].includes(roleInput)
    ? roleInput
    : "auditor";

  const cookieStore = await cookies();
  cookieStore.set(
    DEMO_PROFILE_COOKIE,
    encodeURIComponent(JSON.stringify({ name: name || "Guest", role })),
    { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 },
  );
  redirect("/");
}
