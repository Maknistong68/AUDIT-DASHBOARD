import { cookies } from "next/headers";
import type { UserRole } from "../types";

export const DEMO_PROFILE_COOKIE = "demo_profile";

export interface DemoProfile {
  name: string;
  role: UserRole;
}

/** The visitor's onboarding choice, stored in a cookie — no accounts. */
export async function readDemoProfile(): Promise<DemoProfile | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DEMO_PROFILE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<DemoProfile>;
    if (
      typeof parsed.name === "string" &&
      (parsed.role === "admin" ||
        parsed.role === "auditor" ||
        parsed.role === "viewer")
    ) {
      return { name: parsed.name.slice(0, 80), role: parsed.role };
    }
  } catch {
    // fall through: malformed cookie counts as not onboarded
  }
  return null;
}
