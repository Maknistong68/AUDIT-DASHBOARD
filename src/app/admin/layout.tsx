import Link from "next/link";
import { getCurrentUser } from "@/lib/data";
import { isDemoMode } from "@/lib/demo/mode";
import { DemoAdminView } from "./DemoAdminView";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
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

  if (isDemoMode()) {
    return <DemoAdminView />;
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
