import { NextResponse, type NextRequest } from "next/server";

const DEMO_PROFILE_COOKIE = "demo_profile";

/**
 * The onboarding gate. There are no accounts and no database: a visitor
 * picks a display name and a role on /welcome, that choice is held in one
 * cookie, and every other route requires it.
 *
 * The role decides which controls a page offers — it is a UI affordance,
 * not a security boundary. Nothing here is a substitute for real
 * authentication, which arrives with the database.
 */
export function middleware(request: NextRequest) {
  const onboarded = Boolean(request.cookies.get(DEMO_PROFILE_COOKIE)?.value);
  const path = request.nextUrl.pathname;
  const isWelcome = path.startsWith("/welcome");

  if (!onboarded && !isWelcome) {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (onboarded && isWelcome) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
