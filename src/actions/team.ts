"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";
import * as userService from "@/lib/services/user.service";

export async function inviteTeamMemberAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  const locRaw = formData.get("locationId");
  const res = await userService.inviteTeamMember(supabase, profile.data, {
    companyId: formData.get("companyId") ? String(formData.get("companyId")) : undefined,
    email: String(formData.get("email")),
    name: String(formData.get("name")),
    role: formData.get("role") as "MANAGER" | "BARBER",
    password: String(formData.get("password")),
    locationId: locRaw ? String(locRaw) : undefined,
  });
  if (!res.ok) {
    redirect(`/team?error=${encodeURIComponent(res.error)}`);
  }
  revalidatePath("/team");
  redirect("/team");
}
