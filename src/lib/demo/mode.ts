/**
 * Demo mode: the app runs entirely on the built-in dataset — no database,
 * no authentication, a lightweight onboarding instead of login.
 *
 * Active when Supabase is not configured (deploy to Vercel with no env vars
 * and you get the demo), or forced with NEXT_PUBLIC_DEMO_MODE=1 even when
 * Supabase credentials are present.
 */
import { hasSupabaseEnv } from "../supabase/env";

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "1" || !hasSupabaseEnv();
}
