import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/db";

export const metadata: Metadata = {
  title: "Audit Dashboard",
  description:
    "Contractor audit scoring and compliance-trend analytics platform",
};

async function currentProfile(): Promise<ProfileRow | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();
  return (data as ProfileRow | null) ?? null;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await currentProfile();

  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link className="brand" href="/">
              Audit Dashboard
            </Link>
            {profile && (
              <>
                <nav>
                  <Link href="/">Overview</Link>
                  <Link href="/contractors">Contractors</Link>
                  <Link href="/audits">Audits</Link>
                  <Link href="/actions-queue">Actions</Link>
                  {profile.role === "admin" && <Link href="/admin">Admin</Link>}
                </nav>
                <span className="who">
                  {profile.full_name ?? "Signed in"} · {profile.role}
                </span>
                <form action="/auth/signout" method="post">
                  <button className="ghost" type="submit">
                    Sign out
                  </button>
                </form>
              </>
            )}
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
