import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";

export default async function Home() {
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }
  const supabase = await createClient();
  const uid = await authService.getSessionUserId(supabase);
  if (!uid) {
    redirect("/login");
  }
  const profile = await authService.getProfileForUser(supabase, uid);
  redirect(profile.ok ? "/dashboard" : "/no-profile");
}
