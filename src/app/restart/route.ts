import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_PROFILE_COOKIE } from "@/lib/demo/profile";

/** Clear the onboarding cookie and start over. The only stored state this
 * app keeps about a person is that cookie, so this erases all of it. */
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_PROFILE_COOKIE);
  redirect("/welcome");
}
