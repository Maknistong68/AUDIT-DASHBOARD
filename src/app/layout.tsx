import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { readDemoProfile } from "@/lib/demo/profile";
import { EhssStoreProvider } from "@/lib/ehss/store";
import { AdminShortcut, TabBar, TopNav } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Audit Dashboard",
  description:
    "Contractor EHSS quarterly audit scoring and compliance-trend analytics",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The app paints to the edges so the tab bar can sit over the home
  // indicator; every fixed element pads itself with env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eaeef5" },
    { media: "(prefers-color-scheme: dark)", color: "#080a0f" },
  ],
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
        <EhssStoreProvider>
          <div className="shell">
            <header className="topbar">
              <Link className="brand" href="/">
                Audit Dashboard
              </Link>
              {profile && (
                <>
                  <TopNav role={profile.role} />
                  <span className="who">
                    {profile.name} · {profile.role} · demo
                  </span>
                  {profile.role === "admin" && <AdminShortcut />}
                  <form action="/restart" method="post">
                    <button className="ghost" type="submit">
                      Restart demo
                    </button>
                  </form>
                </>
              )}
            </header>
            <main>{children}</main>
          </div>
          {profile && <TabBar />}
        </EhssStoreProvider>
      </body>
    </html>
  );
}
