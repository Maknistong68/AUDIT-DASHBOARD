/** True when the Supabase credentials are configured. Pages render a setup
 * notice instead of crashing when they are not (e.g. a fresh clone). */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
