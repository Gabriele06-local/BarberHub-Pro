"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";

export async function loginAction(_: string | null, formData: FormData): Promise<string | null> {
  const supabase = await createClient();
  const result = await authService.signInWithPassword(supabase, {
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!result.ok) {
    return result.error;
  }
  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await authService.signOut(supabase);
  redirect("/login");
}
