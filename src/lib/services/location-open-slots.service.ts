import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, ServiceResult } from "@/types/domain";
import { resolveCompanyScope } from "@/lib/services/scope";
import { ROME_OPEN_SLOT_MINUTES } from "@/lib/booking/rome-open-slots";
import type { ExpandedOpenSlotInsert } from "@/lib/booking/expand-public-slots";
import { locationOpenSlotsReplaceSchema } from "@/lib/validation/schemas";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export type LocationOpenSlotRow = {
  id: string;
  slot_date: string;
  slot_mins: number;
  barber_id: string | null;
  seats: number;
  slot_duration_mins: number;
  show_barber_name: boolean;
};

function assertSlotMins(mins: number[]): string | null {
  const allowed = new Set<number>(ROME_OPEN_SLOT_MINUTES);
  for (const m of mins) {
    if (!allowed.has(m)) {
      return "Uno o più orari non sono nella fascia consentita (:00 / :30, 05:00–23:00)";
    }
  }
  return null;
}

async function assertCanUseLocation(
  supabase: SupabaseClient,
  actor: Profile,
  companyId: string,
  locationId: string,
): Promise<ServiceResult<string>> {
  if (actor.role !== "ADMIN" && actor.role !== "MANAGER") {
    return { ok: false, error: "Non autorizzato" };
  }
  const scope = resolveCompanyScope(actor, companyId);
  if (!scope.ok) {
    return scope;
  }
  if (actor.role === "MANAGER") {
    if (!actor.location_id || actor.location_id !== locationId) {
      return { ok: false, error: "Non autorizzato per questa sede" };
    }
  }
  const { data: loc, error } = await supabase
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .eq("company_id", scope.data)
    .maybeSingle();
  if (error) {
    return { ok: false, error: error.message };
  }
  if (!loc) {
    return { ok: false, error: "Sede non valida" };
  }
  return { ok: true, data: scope.data };
}

export async function listLocationOpenSlots(
  supabase: SupabaseClient,
  actor: Profile,
  companyId: string,
  locationId: string,
  slotDate: string,
): Promise<ServiceResult<number[]>> {
  if (!dateRe.test(slotDate)) {
    return { ok: false, error: "Data non valida" };
  }
  const gate = await assertCanUseLocation(supabase, actor, companyId, locationId);
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }
  const { data, error } = await supabase
    .from("location_open_slots")
    .select("slot_mins")
    .eq("location_id", locationId)
    .eq("slot_date", slotDate)
    .order("slot_mins", { ascending: true });
  if (error) {
    return { ok: false, error: error.message };
  }
  const mins = (data ?? []).map((r) => r.slot_mins as number);
  return { ok: true, data: mins };
}

export async function listLocationOpenSlotsInRange(
  supabase: SupabaseClient,
  actor: Profile,
  companyId: string,
  locationId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ServiceResult<LocationOpenSlotRow[]>> {
  if (!dateRe.test(dateFrom) || !dateRe.test(dateTo)) {
    return { ok: false, error: "Intervallo date non valido" };
  }
  const gate = await assertCanUseLocation(supabase, actor, companyId, locationId);
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }
  const { data, error } = await supabase
    .from("location_open_slots")
    .select("id, slot_date, slot_mins, barber_id, seats, slot_duration_mins, show_barber_name")
    .eq("location_id", locationId)
    .gte("slot_date", dateFrom)
    .lte("slot_date", dateTo)
    .order("slot_date", { ascending: true })
    .order("slot_mins", { ascending: true });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: (data ?? []) as LocationOpenSlotRow[] };
}

export async function insertLocationOpenSlotRows(
  supabase: SupabaseClient,
  actor: Profile,
  companyId: string,
  locationId: string,
  rows: ExpandedOpenSlotInsert[],
): Promise<ServiceResult<number>> {
  const gate = await assertCanUseLocation(supabase, actor, companyId, locationId);
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }
  if (rows.length === 0) {
    return { ok: true, data: 0 };
  }
  const companyScopeId = gate.data;
  const chunk = 80;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk).map((r) => ({
      company_id: companyScopeId,
      location_id: locationId,
      slot_date: r.slot_date,
      slot_mins: r.slot_mins,
      barber_id: r.barber_id,
      seats: r.seats,
      slot_duration_mins: r.slot_duration_mins,
      show_barber_name: r.show_barber_name,
      created_by: actor.id,
    }));
    const { error } = await supabase.from("location_open_slots").insert(part);
    if (error) {
      return { ok: false, error: error.message };
    }
    inserted += part.length;
  }
  return { ok: true, data: inserted };
}

export async function deleteLocationOpenSlotsByIds(
  supabase: SupabaseClient,
  actor: Profile,
  companyId: string,
  locationId: string,
  ids: string[],
): Promise<ServiceResult<null>> {
  if (!ids.length) {
    return { ok: true, data: null };
  }
  const gate = await assertCanUseLocation(supabase, actor, companyId, locationId);
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }
  const { error } = await supabase
    .from("location_open_slots")
    .delete()
    .eq("location_id", locationId)
    .in("id", ids);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}

/** Sostituisce tutti gli slot di un giorno con griglia semplice (solo orari, in salone, 30 min). */
export async function replaceLocationOpenSlots(
  supabase: SupabaseClient,
  actor: Profile,
  input: unknown,
): Promise<ServiceResult<null>> {
  const parsed = locationOpenSlotsReplaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dati non validi" };
  }
  const { companyId, locationId, slotDate, slotMins } = parsed.data;
  const bad = assertSlotMins(slotMins);
  if (bad) {
    return { ok: false, error: bad };
  }
  const gate = await assertCanUseLocation(supabase, actor, companyId, locationId);
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }
  const companyScopeId = gate.data;

  const { error: delErr } = await supabase
    .from("location_open_slots")
    .delete()
    .eq("location_id", locationId)
    .eq("slot_date", slotDate);
  if (delErr) {
    return { ok: false, error: delErr.message };
  }

  if (slotMins.length === 0) {
    return { ok: true, data: null };
  }

  const rows = slotMins.map((slot_mins) => ({
    company_id: companyScopeId,
    location_id: locationId,
    slot_date: slotDate,
    slot_mins,
    barber_id: null as string | null,
    seats: 1,
    slot_duration_mins: 30,
    show_barber_name: true,
    created_by: actor.id,
  }));

  const { error: insErr } = await supabase.from("location_open_slots").insert(rows);
  if (insErr) {
    return { ok: false, error: insErr.message };
  }
  return { ok: true, data: null };
}
