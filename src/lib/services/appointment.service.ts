import "server-only";

import { addDays, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Appointment, AppointmentStatus, Profile, ServiceResult } from "@/types/domain";
import { romeYmdAndMinsFromInstant } from "@/lib/booking/rome-calendar";
import { appointmentCreateSchema, publicBookSchema } from "@/lib/validation/schemas";
import { resolveCompanyScope } from "@/lib/services/scope";

function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60_000);
}

function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

async function hasOverlap(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    locationId: string;
    at: Date;
    slotMinutes: number;
    excludeAppointmentId?: string;
  },
): Promise<ServiceResult<boolean>> {
  const end = addMinutes(params.at, params.slotMinutes);
  let query = supabase
    .from("appointments")
    .select("id,date,status")
    .eq("company_id", params.companyId)
    .eq("location_id", params.locationId)
    .in("status", ["pending", "confirmed"]);

  if (params.excludeAppointmentId) {
    query = query.neq("id", params.excludeAppointmentId);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }

  for (const row of data ?? []) {
    const otherStart = new Date(row.date as string);
    const otherEnd = addMinutes(otherStart, params.slotMinutes);
    if (rangesOverlap(params.at, end, otherStart, otherEnd)) {
      return { ok: true, data: true };
    }
  }
  return { ok: true, data: false };
}

export async function createAppointment(
  supabase: SupabaseClient,
  actor: Profile,
  input: unknown,
): Promise<ServiceResult<Appointment>> {
  const parsed = appointmentCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dati appuntamento non validi" };
  }
  if (actor.role !== "ADMIN" && actor.role !== "MANAGER" && actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Non autorizzato" };
  }
  const scope = resolveCompanyScope(actor, parsed.data.companyId);
  if (!scope.ok) {
    return scope;
  }
  if (scope.data !== parsed.data.companyId) {
    return { ok: false, error: "Company mismatch" };
  }

  const { data: clientRow, error: cErr } = await supabase
    .from("clients")
    .select("id,company_id,location_id")
    .eq("id", parsed.data.clientId)
    .eq("company_id", scope.data)
    .maybeSingle();
  if (cErr || !clientRow) {
    return { ok: false, error: cErr?.message ?? "Cliente non trovato" };
  }
  const locationId = clientRow.location_id as string;

  if (actor.role === "MANAGER") {
    if (!actor.location_id || actor.location_id !== locationId) {
      return { ok: false, error: "Cliente non appartiene alla tua sede" };
    }
  }

  const barberId = parsed.data.barberId ?? null;
  if (barberId) {
    const { data: barberRow, error: bErr } = await supabase
      .from("profiles")
      .select("id,role,location_id")
      .eq("id", barberId)
      .eq("company_id", scope.data)
      .maybeSingle();
    if (bErr || !barberRow || barberRow.role !== "BARBER") {
      return { ok: false, error: bErr?.message ?? "Barber non valido" };
    }
    if ((barberRow.location_id as string | null) !== locationId) {
      return { ok: false, error: "Il barber non è assegnato a questa sede" };
    }
  }

  const at = new Date(parsed.data.date);
  const overlap = await hasOverlap(supabase, {
    companyId: scope.data,
    locationId,
    at,
    slotMinutes: parsed.data.slotMinutes,
  });
  if (!overlap.ok) {
    return overlap;
  }
  if (overlap.data) {
    return { ok: false, error: "Slot già occupato", code: "DOUBLE_BOOK" };
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      company_id: scope.data,
      location_id: locationId,
      client_id: parsed.data.clientId,
      barber_id: barberId,
      manager_id: parsed.data.managerId ?? actor.id,
      service_name: parsed.data.serviceName,
      date: at.toISOString(),
      status: parsed.data.status as AppointmentStatus,
    })
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data as Appointment };
}

export async function updateAppointmentStatus(
  supabase: SupabaseClient,
  actor: Profile,
  params: { id: string; status: AppointmentStatus },
): Promise<ServiceResult<Appointment>> {
  const { data: existing, error: exErr } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", params.id)
    .single();
  if (exErr || !existing) {
    return { ok: false, error: exErr?.message ?? "Appuntamento non trovato" };
  }
  const scope = resolveCompanyScope(actor, existing.company_id as string);
  if (!scope.ok) {
    return scope;
  }
  if (actor.role === "BARBER" && existing.barber_id !== actor.id) {
    return { ok: false, error: "Non autorizzato" };
  }

  const { data, error } = await supabase
    .from("appointments")
    .update({ status: params.status })
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data as Appointment };
}

const dateYmdRe = /^\d{4}-\d{2}-\d{2}$/;

export type CalendarPanelAppointmentRow = {
  id: string;
  date: string;
  status: AppointmentStatus;
  service_name: string;
  barber_id: string | null;
  client_name: string;
  client_phone: string;
};

/** Appuntamenti pending/confirmed per la griglia calendario (match su data/ora Roma + barber come gli slot pubblici). */
export async function listCalendarPanelAppointments(
  supabase: SupabaseClient,
  actor: Profile,
  companyId: string,
  locationId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ServiceResult<CalendarPanelAppointmentRow[]>> {
  if (!dateYmdRe.test(dateFrom) || !dateYmdRe.test(dateTo)) {
    return { ok: false, error: "Intervallo date non valido" };
  }
  if (actor.role !== "ADMIN" && actor.role !== "MANAGER") {
    return { ok: false, error: "Non autorizzato" };
  }
  const scope = resolveCompanyScope(actor, companyId);
  if (!scope.ok) {
    return scope;
  }
  if (scope.data !== companyId) {
    return { ok: false, error: "Company mismatch" };
  }
  if (actor.role === "MANAGER") {
    if (!actor.location_id || actor.location_id !== locationId) {
      return { ok: false, error: "Non autorizzato per questa sede" };
    }
  }
  const { data: loc, error: locErr } = await supabase
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .eq("company_id", scope.data)
    .maybeSingle();
  if (locErr) {
    return { ok: false, error: locErr.message };
  }
  if (!loc) {
    return { ok: false, error: "Sede non valida" };
  }

  const rangeStart = addDays(parseISO(`${dateFrom}T12:00:00`), -1).toISOString();
  const rangeEnd = addDays(parseISO(`${dateTo}T12:00:00`), 2).toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .select("id, date, status, service_name, barber_id, clients ( name, phone )")
    .eq("company_id", scope.data)
    .eq("location_id", locationId)
    .in("status", ["pending", "confirmed"])
    .gte("date", rangeStart)
    .lt("date", rangeEnd);

  if (error) {
    return { ok: false, error: error.message };
  }

  const out: CalendarPanelAppointmentRow[] = [];
  for (const row of data ?? []) {
    const { ymd } = romeYmdAndMinsFromInstant(String(row.date));
    if (ymd < dateFrom || ymd > dateTo) {
      continue;
    }
    const raw = row.clients as { name?: string; phone?: string } | { name?: string; phone?: string }[] | null;
    const c = Array.isArray(raw) ? raw[0] : raw;
    if (!c?.name) {
      continue;
    }
    out.push({
      id: row.id as string,
      date: row.date as string,
      status: row.status as AppointmentStatus,
      service_name: row.service_name as string,
      barber_id: (row.barber_id as string | null) ?? null,
      client_name: c.name,
      client_phone: c.phone ?? "",
    });
  }
  return { ok: true, data: out };
}

export async function publicBookAppointment(
  supabase: SupabaseClient,
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const parsed = publicBookSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dati prenotazione non validi" };
  }
  const { data, error } = await supabase.rpc("rpc_public_book_appointment", {
    p_company_id: parsed.data.companyId,
    p_client_name: parsed.data.clientName,
    p_client_phone: parsed.data.clientPhone,
    p_client_notes: parsed.data.clientNotes ?? "",
    p_service_name: parsed.data.serviceName,
    p_at: parsed.data.date,
    p_slot_minutes: parsed.data.slotMinutes,
    p_location_id: parsed.data.locationId ?? null,
    p_barber_id: parsed.data.barberId ?? null,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: { id: data as string } };
}
