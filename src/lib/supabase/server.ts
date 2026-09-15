import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Supabase client for Server Components, Server Actions and Route Handlers.
 * Auth state travels in cookies; RLS applies as the signed-in user. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component: cookie writes are not possible
            // there, and middleware refreshes the session anyway.
          }
        },
      },
    },
  );
}
