import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/mode";
import { DEMO_PROFILE_COOKIE } from "@/lib/demo/profile";

export async function POST() {
  if (isDemoMode()) {
    const cookieStore = await cookies();
    cookieStore.delete(DEMO_PROFILE_COOKIE);
    redirect("/welcome");
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
