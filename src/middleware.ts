import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

const DEMO_PROFILE_COOKIE = "demo_profile";

function isDemo(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "1" || !hasSupabaseEnv();
}

/** Demo mode: a lightweight onboarding gate (no accounts). Supabase mode:
 * refresh the session cookie and require sign-in everywhere except /login. */
export async function middleware(request: NextRequest) {
  if (isDemo()) {
    const onboarded = Boolean(request.cookies.get(DEMO_PROFILE_COOKIE)?.value);
    const path = request.nextUrl.pathname;
    const isWelcome = path.startsWith("/welcome");

    if (!onboarded && !isWelcome) {
      const url = request.nextUrl.clone();
      url.pathname = "/welcome";
      url.search = "";
      return NextResponse.redirect(url);
    }
    if (onboarded && (isWelcome || path.startsWith("/login"))) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run other code between createServerClient and getUser():
  // the session refresh happens inside this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLoginPage = path.startsWith("/login");

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && (isLoginPage || path.startsWith("/welcome"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
