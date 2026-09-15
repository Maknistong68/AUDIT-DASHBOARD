import { hasSupabaseEnv } from "@/lib/supabase/env";
import { SetupNotice } from "@/components/SetupNotice";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  if (!hasSupabaseEnv()) {
    return <SetupNotice />;
  }
  return (
    <div className="card login-card">
      <h2>Sign in</h2>
      <p className="sub">
        Accounts are provisioned by an administrator. New users start as
        viewers.
      </p>
      <LoginForm />
    </div>
  );
}
