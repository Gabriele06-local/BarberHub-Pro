import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Location, Profile, ServiceResult } from "@/types/domain";
import { locationCreateSchema } from "@/lib/validation/schemas";
import { resolveCompanyScope } from "@/lib/services/scope";

export async function listLocations(
  supabase: SupabaseClient,
  actor: Profile,
  companyId?: string | null,
): Promise<ServiceResult<Location[]>> {
  const scope = resolveCompanyScope(actor, companyId);
  if (!scope.ok) {
    return scope;
  }
  if (
    actor.role !== "ADMIN" &&
    actor.role !== "MANAGER" &&
    actor.role !== "BARBER" &&
    actor.role !== "SUPER_ADMIN"
  ) {
    return { ok: false, error: "Non autorizzato" };
  }

  let query = supabase
    .from("locations")
    .select("*")
    .eq("company_id", scope.data)
    .order("created_at", { ascending: true });

  if (actor.role === "MANAGER" || actor.role === "BARBER") {
    if (!actor.location_id) {
      return { ok: false, error: "Sede non assegnata al profilo" };
    }
    query = query.eq("id", actor.location_id);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data as Location[] };
}

export async function createLocation(
  supabase: SupabaseClient,
  actor: Profile,
  input: unknown,
): Promise<ServiceResult<Location>> {
  if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Solo l’admin aziendale può creare nuove sedi" };
  }
  const parsed = locationCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors.name?.[0] ?? "Dati non validi" };
  }
  const companyId =
    actor.role === "SUPER_ADMIN" ? parsed.data.companyId ?? null : actor.company_id;
  if (!companyId) {
    return { ok: false, error: "companyId richiesto" };
  }
  if (actor.role === "ADMIN" && companyId !== actor.company_id) {
    return { ok: false, error: "Azienda non consentita" };
  }

  const { data, error } = await supabase
    .from("locations")
    .insert({ company_id: companyId, name: parsed.data.name.trim() })
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data as Location };
}
