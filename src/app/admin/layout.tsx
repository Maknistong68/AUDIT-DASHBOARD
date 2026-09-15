import Link from "next/link";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { SetupNotice } from "@/components/SetupNotice";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabaseEnv()) return <SetupNotice />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  if ((profile as { role: string } | null)?.role !== "admin") {
    return (
      <div className="card">
        <h2>Admins only</h2>
        <p className="sub">
          This section manages reference data and user roles. Ask an
          administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <nav className="admin-nav">
        <Link href="/admin/contractors">Contractors</Link>
        <Link href="/admin/questions">Questions</Link>
        <Link href="/admin/nc-categories">NC classifications</Link>
        <Link href="/admin/users">Users</Link>
      </nav>
      {children}
    </div>
  );
}
