import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, Profile, ServiceResult } from "@/types/domain";

export type ClientWithLastBooking = Client & { lastBookingAt: string | null };
import { clientUpsertSchema } from "@/lib/validation/schemas";
import { canManageClients, resolveCompanyScope } from "@/lib/services/scope";

export async function listClients(
  supabase: SupabaseClient,
  actor: Profile,
  companyId?: string | null,
): Promise<ServiceResult<Client[]>> {
  const scope = resolveCompanyScope(actor, companyId);
  if (!scope.ok) {
    return scope;
  }
  if (!canManageClients(actor) && actor.role !== "BARBER") {
    return { ok: false, error: "Non autorizzato" };
  }
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("company_id", scope.data)
    .order("name", { ascending: true });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data as Client[] };
}

export async function listClientsWithLastBooking(
  supabase: SupabaseClient,
  actor: Profile,
  companyId?: string | null,
): Promise<ServiceResult<ClientWithLastBooking[]>> {
  const clients = await listClients(supabase, actor, companyId);
  if (!clients.ok) {
    return clients;
  }
  const scope = resolveCompanyScope(actor, companyId);
  if (!scope.ok) {
    return scope;
  }

  const { data: apps, error } = await supabase
    .from("appointments")
    .select("client_id, date")
    .eq("company_id", scope.data)
    .order("date", { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  const lastByClient = new Map<string, string>();
  for (const row of apps ?? []) {
    const clientId = row.client_id as string;
    if (!lastByClient.has(clientId)) {
      lastByClient.set(clientId, row.date as string);
    }
  }

  return {
    ok: true,
    data: clients.data.map((c) => ({
      ...(c as Client),
      email: (c as Client).email ?? null,
      lastBookingAt: lastByClient.get(c.id) ?? null,
    })),
  };
}

export async function upsertClient(
  supabase: SupabaseClient,
  actor: Profile,
  input: unknown,
): Promise<ServiceResult<Client>> {
  if (!canManageClients(actor)) {
    return { ok: false, error: "Non autorizzato" };
  }
  const parsed = clientUpsertSchema.safeParse(input);
  if (!parsed.success) {
    const fe = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      error: fe.email?.[0] ?? fe.phone?.[0] ?? fe.name?.[0] ?? "Dati cliente non validi",
    };
  }
  const scope = resolveCompanyScope(actor, parsed.data.companyId);
  if (!scope.ok) {
    return scope;
  }
  if (scope.data !== parsed.data.companyId) {
    return { ok: false, error: "Company mismatch" };
  }

  let locationId = parsed.data.locationId ?? null;
  if (actor.role === "MANAGER") {
    locationId = actor.location_id;
    if (!locationId) {
      return { ok: false, error: "Sede non assegnata al profilo" };
    }
  }
  if ((actor.role === "ADMIN" || actor.role === "SUPER_ADMIN") && !locationId) {
    return { ok: false, error: "Seleziona la sede del cliente" };
  }

  const { data: locRow, error: locErr } = await supabase
    .from("locations")
    .select("id")
    .eq("id", locationId as string)
    .eq("company_id", scope.data)
    .maybeSingle();
  if (locErr) {
    return { ok: false, error: locErr.message };
  }
  if (!locRow) {
    return { ok: false, error: "Sede non valida" };
  }

  const row = {
    id: parsed.data.id,
    company_id: scope.data,
    location_id: locationId,
    name: parsed.data.name,
    phone: parsed.data.phone,
    email: parsed.data.email ?? null,
    notes: parsed.data.notes ?? null,
  };

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("clients")
      .update({
        name: row.name,
        phone: row.phone,
        email: row.email,
        notes: row.notes,
        location_id: row.location_id,
      })
      .eq("id", parsed.data.id)
      .eq("company_id", scope.data)
      .select("*")
      .single();
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, data: data as Client };
  }

  const { data, error } = await supabase.from("clients").insert(row).select("*").single();
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data as Client };
}

export async function deleteClient(
  supabase: SupabaseClient,
  actor: Profile,
  params: { id: string; companyId?: string | null },
): Promise<ServiceResult<null>> {
  if (!canManageClients(actor)) {
    return { ok: false, error: "Non autorizzato" };
  }
  const scope = resolveCompanyScope(actor, params.companyId);
  if (!scope.ok) {
    return scope;
  }
  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", params.id)
    .eq("company_id", scope.data);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}
