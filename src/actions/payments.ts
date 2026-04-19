"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";
import * as paymentService from "@/lib/services/payment.service";

export async function savePaymentAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  const returnTo = String(formData.get("returnTo") ?? "payments");
  const base = returnTo === "dashboard" ? "/dashboard" : "/payments";
  const idRaw = formData.get("id");
  const res = await paymentService.upsertPayment(supabase, profile.data, {
    id: idRaw ? String(idRaw) : undefined,
    companyId: String(formData.get("companyId")),
    clientId: String(formData.get("clientId")),
    amount: Number(formData.get("amount")),
    category: String(formData.get("category")),
    method: String(formData.get("method")) as "cash" | "srl" | "privato",
    date: String(formData.get("date")),
  });
  if (!res.ok) {
    redirect(`${base}?error=${encodeURIComponent(res.error)}`);
  }
  revalidatePath("/payments");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect(base);
}

export async function deletePaymentAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  const returnTo = String(formData.get("returnTo") ?? "payments");
  const base = returnTo === "dashboard" ? "/dashboard" : "/payments";
  const res = await paymentService.deletePayment(supabase, profile.data, {
    id: String(formData.get("id")),
    companyId: formData.get("companyId") ? String(formData.get("companyId")) : undefined,
  });
  if (!res.ok) {
    redirect(`${base}?error=${encodeURIComponent(res.error)}`);
  }
  revalidatePath("/payments");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect(base);
}
