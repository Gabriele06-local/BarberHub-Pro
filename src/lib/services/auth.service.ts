import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/domain";
import type { ServiceResult } from "@/types/domain";
import { loginSchema } from "@/lib/validation/schemas";

export async function signInWithPassword(
  supabase: SupabaseClient,
  input: unknown,
): Promise<ServiceResult<{ email: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors.email?.[0] ?? "Dati non validi" };
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: { email: parsed.data.email } };
}

export async function signOut(supabase: SupabaseClient): Promise<ServiceResult<null>> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}

export async function getSessionUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  return data.user.id;
}

export async function getProfileForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ServiceResult<Profile>> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,role,company_id,location_id,created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Profilo non trovato" };
  }
  return {
    ok: true,
    data: {
      id: data.id,
      name: data.name,
      role: data.role as Profile["role"],
      company_id: data.company_id,
      location_id: data.location_id ?? null,
      created_at: data.created_at,
    },
  };
}

export async function getCurrentProfile(
  supabase: SupabaseClient,
): Promise<ServiceResult<Profile>> {
  const uid = await getSessionUserId(supabase);
  if (!uid) {
    return { ok: false, error: "Non autenticato" };
  }
  return getProfileForUser(supabase, uid);
}
