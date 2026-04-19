"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";
import * as locationService from "@/lib/services/location.service";

export async function createLocationAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  const res = await locationService.createLocation(supabase, profile.data, {
    companyId: formData.get("companyId") ? String(formData.get("companyId")) : undefined,
    name: String(formData.get("name") ?? ""),
  });
  if (!res.ok) {
    redirect(`/locations?error=${encodeURIComponent(res.error)}`);
  }
  revalidatePath("/locations");
  revalidatePath("/dashboard");
  revalidatePath("/team");
  redirect("/locations");
}
