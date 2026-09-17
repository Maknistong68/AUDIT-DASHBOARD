import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/data";
import { isDemoMode } from "@/lib/demo/mode";

export const metadata: Metadata = {
  title: "Audit Dashboard",
  description:
    "Contractor audit scoring and compliance-trend analytics platform",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const demo = isDemoMode();

  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link className="brand" href="/">
              Audit Dashboard
            </Link>
            {user && (
              <>
                <nav>
                  <Link href="/">Overview</Link>
                  <Link href="/contractors">Contractors</Link>
                  <Link href="/audits">Audits</Link>
                  <Link href="/actions-queue">Actions</Link>
                  {user.role === "admin" && <Link href="/admin">Admin</Link>}
                </nav>
                <span className="who">
                  {user.name ?? "Signed in"} · {user.role}
                  {demo ? " · demo" : ""}
                </span>
                <form action="/auth/signout" method="post">
                  <button className="ghost" type="submit">
                    {demo ? "Restart demo" : "Sign out"}
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
