import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { readDemoProfile } from "@/lib/demo/profile";

export const metadata: Metadata = {
  title: "Audit Dashboard",
  description:
    "Contractor EHSS quarterly audit scoring and compliance-trend analytics",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await readDemoProfile();

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
                  <Link href="/">Dashboard</Link>
                  <Link href="/contractors">Contractors</Link>
                  <Link href="/audits">Audits</Link>
                  <Link href="/findings">Findings</Link>
                  {profile.role === "admin" && (
                    <Link href="/admin">Reference</Link>
                  )}
                </nav>
                <span className="who">
                  {profile.name} · {profile.role} · demo
                </span>
                <form action="/auth/signout" method="post">
                  <button className="ghost" type="submit">
                    Restart demo
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
