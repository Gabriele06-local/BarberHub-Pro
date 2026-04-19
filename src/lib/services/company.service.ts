import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Profile, ServiceResult, UserRole } from "@/types/domain";
import { assignAdminSchema, companyCreateSchema, companyDeleteSchema, companyUpdateSchema } from "@/lib/validation/schemas";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createOrUpdateAuthUserWithPassword } from "@/lib/services/admin-auth-user";

export async function listCompanies(
  supabase: SupabaseClient,
  actor: Profile,
): Promise<ServiceResult<Company[]>> {
  if (actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Non autorizzato" };
  }
  const { data, error } = await supabase.from("companies").select("*").order("created_at", {
    ascending: false,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data as Company[] };
}

export async function createCompany(
  supabase: SupabaseClient,
  actor: Profile,
  input: unknown,
): Promise<ServiceResult<Company>> {
  if (actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Non autorizzato" };
  }
  const parsed = companyCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors.name?.[0] ?? "Dati non validi" };
  }
  const { data, error } = await supabase
    .from("companies")
    .insert({ name: parsed.data.name })
    .select("*")
    .single();
  if (error) {
    return { ok: false, error: error.message };
  }
  const company = data as Company;
  const { error: locErr } = await supabase
    .from("locations")
    .insert({ company_id: company.id, name: "Sede principale" });
  if (locErr) {
    return { ok: false, error: locErr.message };
  }
  return { ok: true, data: company };
}

export async function updateCompany(
  supabase: SupabaseClient,
  actor: Profile,
  input: unknown,
): Promise<ServiceResult<Company>> {
  if (actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Non autorizzato" };
  }
  const parsed = companyUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dati non validi" };
  }
  const { data, error } = await supabase
    .from("companies")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)
    .select("*")
    .single();
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data as Company };
}

export async function deleteCompany(
  supabase: SupabaseClient,
  actor: Profile,
  input: unknown,
): Promise<ServiceResult<null>> {
  if (actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Non autorizzato" };
  }
  const parsed = companyDeleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dati non validi" };
  }

  const { count, error: countErr } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", parsed.data.id);
  if (countErr) {
    return { ok: false, error: countErr.message };
  }
  if (count && count > 0) {
    return {
      ok: false,
      error:
        "Impossibile eliminare: ci sono utenti (profiles) collegati a questa azienda. Rimuovi o riassegna i profili prima.",
    };
  }

  const { error } = await supabase.from("companies").delete().eq("id", parsed.data.id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}

export async function countProfilesForCompany(
  supabase: SupabaseClient,
  actor: Profile,
  companyId: string,
): Promise<ServiceResult<number>> {
  if (actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Non autorizzato" };
  }
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: count ?? 0 };
}

export async function getCompanyForActor(
  supabase: SupabaseClient,
  actor: Profile,
  companyId: string,
): Promise<ServiceResult<Company>> {
  if (actor.role === "SUPER_ADMIN") {
    const { data, error } = await supabase.from("companies").select("*").eq("id", companyId).single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Azienda non trovata" };
    }
    return { ok: true, data: data as Company };
  }
  if (!actor.company_id || actor.company_id !== companyId) {
    return { ok: false, error: "Non autorizzato" };
  }
  const { data, error } = await supabase.from("companies").select("*").eq("id", companyId).single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Azienda non trovata" };
  }
  return { ok: true, data: data as Company };
}

export async function assignCompanyAdmin(
  supabase: SupabaseClient,
  actor: Profile,
  input: unknown,
): Promise<ServiceResult<{ userId: string }>> {
  if (actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Non autorizzato" };
  }
  const parsed = assignAdminSchema.safeParse(input);
  if (!parsed.success) {
    const fe = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      error:
        fe.password?.[0] ?? fe.email?.[0] ?? fe.name?.[0] ?? fe.companyId?.[0] ?? "Dati non validi",
    };
  }

  const adminClient = tryCreateAdminClient();
  if (!adminClient.ok) {
    return { ok: false, error: adminClient.error };
  }
  const admin = adminClient.data;

  const authUser = await createOrUpdateAuthUserWithPassword(admin, {
    email: parsed.data.email,
    password: parsed.data.password,
    userMetadata: {
      name: parsed.data.name,
      role: "ADMIN",
      company_id: parsed.data.companyId,
    },
  });
  if (!authUser.ok) {
    return authUser;
  }

  const userId = authUser.data.userId;
  const { error: pErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      name: parsed.data.name,
      role: "ADMIN" as UserRole,
      company_id: parsed.data.companyId,
    },
    { onConflict: "id" },
  );
  if (pErr) {
    return { ok: false, error: pErr.message };
  }
  return { ok: true, data: { userId } };
}

export type PublicCompanyLocation = { id: string; name: string };

export type PublicCompanyInfo = Pick<Company, "id" | "name"> & {
  locations: PublicCompanyLocation[];
};

export async function getPublicCompanyInfo(
  supabase: SupabaseClient,
  companyId: string,
): Promise<ServiceResult<PublicCompanyInfo>> {
  const { data, error } = await supabase.rpc("rpc_public_company_info", {
    p_company_id: companyId,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  const raw = data as unknown;
  const row =
    typeof raw === "string"
      ? (JSON.parse(raw) as {
          id?: string;
          name?: string;
          locations?: { id: string; name: string }[];
        })
      : (raw as {
          id?: string;
          name?: string;
          locations?: { id: string; name: string }[];
        } | null);
  if (!row?.id) {
    return { ok: false, error: "Azienda non trovata" };
  }
  const locs = Array.isArray(row.locations) ? row.locations : [];
  return {
    ok: true,
    data: {
      id: row.id,
      name: String(row.name ?? ""),
      locations: locs.map((l) => ({ id: l.id, name: String(l.name ?? "") })),
    },
  };
}
