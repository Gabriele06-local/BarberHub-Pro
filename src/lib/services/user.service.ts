import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, ServiceResult, UserRole } from "@/types/domain";
import { teamMemberSchema } from "@/lib/validation/schemas";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createOrUpdateAuthUserWithPassword } from "@/lib/services/admin-auth-user";

export async function inviteTeamMember(
  _supabase: SupabaseClient,
  actor: Profile,
  input: unknown,
): Promise<ServiceResult<{ userId: string }>> {
  if (actor.role !== "ADMIN" && actor.role !== "MANAGER" && actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Non autorizzato" };
  }
  const parsed = teamMemberSchema.safeParse(input);
  if (!parsed.success) {
    const fe = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      error:
        fe.password?.[0] ??
        fe.email?.[0] ??
        fe.name?.[0] ??
        fe.role?.[0] ??
        fe.companyId?.[0] ??
        fe.locationId?.[0] ??
        "Dati non validi",
    };
  }

  const companyId =
    actor.role === "SUPER_ADMIN" ? parsed.data.companyId ?? null : actor.company_id;
  if (!companyId) {
    return { ok: false, error: "companyId richiesto" };
  }
  if (actor.role === "ADMIN" && parsed.data.companyId && parsed.data.companyId !== actor.company_id) {
    return { ok: false, error: "Azienda non consentita" };
  }
  if (actor.role === "MANAGER" && parsed.data.role !== "BARBER") {
    return { ok: false, error: "Il manager può creare solo barber" };
  }

  let locationId: string | null = null;
  if (parsed.data.role === "MANAGER" || parsed.data.role === "BARBER") {
    if (actor.role === "MANAGER") {
      locationId = actor.location_id;
      if (!locationId) {
        return { ok: false, error: "Il tuo profilo non ha una sede assegnata" };
      }
    } else if (actor.role === "ADMIN" || actor.role === "SUPER_ADMIN") {
      locationId = parsed.data.locationId ?? null;
      if (!locationId) {
        return { ok: false, error: "Seleziona la sede per manager o barber" };
      }
    }
  }

  const adminClient = tryCreateAdminClient();
  if (!adminClient.ok) {
    return { ok: false, error: adminClient.error };
  }
  const admin = adminClient.data;

  if (parsed.data.role === "MANAGER" || parsed.data.role === "BARBER") {
    const { data: locOk, error: locErr } = await admin
      .from("locations")
      .select("id")
      .eq("id", locationId as string)
      .eq("company_id", companyId)
      .maybeSingle();

    if (locErr) {
      return { ok: false, error: locErr.message };
    }
    if (!locOk) {
      return { ok: false, error: "Sede non valida per questa azienda" };
    }
  }

  const authUser = await createOrUpdateAuthUserWithPassword(admin, {
    email: parsed.data.email,
    password: parsed.data.password,
    userMetadata: {
      name: parsed.data.name,
      role: parsed.data.role,
      company_id: companyId,
      ...(locationId ? { location_id: locationId } : {}),
    },
  });
  if (!authUser.ok) {
    return authUser;
  }
  const userId = authUser.data.userId;

  const role = parsed.data.role as UserRole;
  const { error: pErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      name: parsed.data.name,
      role,
      company_id: companyId,
      location_id: locationId,
    },
    { onConflict: "id" },
  );
  if (pErr) {
    return { ok: false, error: pErr.message };
  }

  return { ok: true, data: { userId } };
}
