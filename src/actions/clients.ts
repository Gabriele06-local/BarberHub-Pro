"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";
import * as clientService from "@/lib/services/client.service";

export async function saveClientAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  const idRaw = formData.get("id");
  const returnTo = String(formData.get("returnTo") ?? "clients");
  const base = returnTo === "dashboard" ? "/dashboard" : "/clients";
  const locRaw = formData.get("locationId");
  const res = await clientService.upsertClient(supabase, profile.data, {
    id: idRaw ? String(idRaw) : undefined,
    companyId: String(formData.get("companyId")),
    locationId: locRaw ? String(locRaw) : undefined,
    name: String(formData.get("name")),
    phone: String(formData.get("phone")),
    email: (() => {
      const v = formData.get("email");
      if (v == null) {
        return "";
      }
      return String(v);
    })(),
    notes: formData.get("notes") ? String(formData.get("notes")) : null,
  });
  if (!res.ok) {
    redirect(`${base}?error=${encodeURIComponent(res.error)}`);
  }
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  redirect(base);
}

export async function deleteClientAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  const returnTo = String(formData.get("returnTo") ?? "clients");
  const base = returnTo === "dashboard" ? "/dashboard" : "/clients";
  const res = await clientService.deleteClient(supabase, profile.data, {
    id: String(formData.get("id")),
    companyId: formData.get("companyId") ? String(formData.get("companyId")) : undefined,
  });
  if (!res.ok) {
    redirect(`${base}?error=${encodeURIComponent(res.error)}`);
  }
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  redirect(base);
}
