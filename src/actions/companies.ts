"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";
import * as companyService from "@/lib/services/company.service";

export async function createCompanyAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  const res = await companyService.createCompany(supabase, profile.data, {
    name: formData.get("name"),
  });
  if (!res.ok) {
    redirect(`/companies?error=${encodeURIComponent(res.error)}`);
  }
  revalidatePath("/companies");
  redirect("/companies");
}

export async function assignAdminAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  const cid = String(formData.get("companyId"));
  const res = await companyService.assignCompanyAdmin(supabase, profile.data, {
    companyId: cid,
    email: String(formData.get("email")),
    name: String(formData.get("name")),
    password: String(formData.get("password")),
  });
  if (!res.ok) {
    const base = cid ? `/companies/${cid}` : "/companies";
    redirect(`${base}?error=${encodeURIComponent(res.error)}`);
  }
  revalidatePath("/companies");
  revalidatePath(`/companies/${cid}`);
  redirect(`/companies/${cid}?notice=admin`);
}

export async function updateCompanyAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  const res = await companyService.updateCompany(supabase, profile.data, {
    id: String(formData.get("id")),
    name: String(formData.get("name")),
  });
  if (!res.ok) {
    const id = String(formData.get("id"));
    redirect(`/companies/${id}?error=${encodeURIComponent(res.error)}`);
  }
  revalidatePath("/companies");
  revalidatePath(`/companies/${String(formData.get("id"))}`);
  redirect(`/companies/${String(formData.get("id"))}?notice=saved`);
}

export async function deleteCompanyAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  const id = String(formData.get("id"));
  const res = await companyService.deleteCompany(supabase, profile.data, { id });
  if (!res.ok) {
    redirect(`/companies/${id}?error=${encodeURIComponent(res.error)}`);
  }
  revalidatePath("/companies");
  redirect("/companies?notice=deleted");
}
