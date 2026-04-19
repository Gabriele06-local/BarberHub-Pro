"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";
import * as appointmentService from "@/lib/services/appointment.service";
import type { CalendarPanelAppointmentRow } from "@/lib/services/appointment.service";

export async function loadCalendarPanelAppointmentsAction(input: {
  companyId: string;
  locationId: string;
  dateFrom: string;
  dateTo: string;
}): Promise<{ ok: true; rows: CalendarPanelAppointmentRow[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    return { ok: false, error: profile.error };
  }
  const res = await appointmentService.listCalendarPanelAppointments(
    supabase,
    profile.data,
    input.companyId,
    input.locationId,
    input.dateFrom,
    input.dateTo,
  );
  if (!res.ok) {
    return { ok: false, error: res.error };
  }
  return { ok: true, rows: res.data };
}

export async function createAppointmentPanelAction(input: {
  companyId: string;
  clientId: string;
  barberId: string | null;
  serviceName: string;
  date: string;
  slotMinutes: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    return { ok: false, error: profile.error };
  }
  const res = await appointmentService.createAppointment(supabase, profile.data, {
    companyId: input.companyId,
    clientId: input.clientId,
    barberId: input.barberId,
    managerId: null,
    serviceName: input.serviceName,
    date: input.date,
    status: "confirmed",
    slotMinutes: input.slotMinutes,
  });
  if (!res.ok) {
    return { ok: false, error: res.error };
  }
  revalidatePath("/calendar");
  return { ok: true };
}

export async function updateAppointmentStatusPanelAction(input: {
  id: string;
  status: "pending" | "confirmed" | "completed";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    return { ok: false, error: profile.error };
  }
  const res = await appointmentService.updateAppointmentStatus(supabase, profile.data, {
    id: input.id,
    status: input.status,
  });
  if (!res.ok) {
    return { ok: false, error: res.error };
  }
  revalidatePath("/calendar");
  return { ok: true };
}

export async function createAppointmentAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  const rawWhen = String(formData.get("date") ?? "");
  const day =
    rawWhen.length >= 10 ? rawWhen.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const res = await appointmentService.createAppointment(supabase, profile.data, {
    companyId: String(formData.get("companyId")),
    clientId: String(formData.get("clientId")),
    barberId: formData.get("barberId") ? String(formData.get("barberId")) : null,
    managerId: null,
    serviceName: String(formData.get("serviceName")),
    date: rawWhen,
    status: "confirmed",
    slotMinutes: Number(formData.get("slotMinutes") ?? 30),
  });
  if (!res.ok) {
    redirect(
      `/calendar?date=${encodeURIComponent(day)}&error=${encodeURIComponent(res.error)}`,
    );
  }
  revalidatePath("/calendar");
  redirect(day ? `/calendar?date=${encodeURIComponent(day)}` : "/calendar");
}

export async function updateAppointmentStatusAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  const res = await appointmentService.updateAppointmentStatus(supabase, profile.data, {
    id: String(formData.get("id")),
    status: String(formData.get("status")) as "pending" | "confirmed" | "completed",
  });
  if (!res.ok) {
    redirect(`/calendar?error=${encodeURIComponent(res.error)}`);
  }
  revalidatePath("/calendar");
  redirect("/calendar");
}

export type PublicBookActionState = { error?: string; done?: boolean } | null;

export async function publicBookAction(
  _: PublicBookActionState,
  formData: FormData,
): Promise<PublicBookActionState> {
  const supabase = await createClient();
  const locRaw = formData.get("locationId");
  const barberRaw = formData.get("barberId");
  const res = await appointmentService.publicBookAppointment(supabase, {
    companyId: String(formData.get("companyId")),
    locationId: locRaw ? String(locRaw) : undefined,
    barberId: barberRaw ? String(barberRaw) : undefined,
    clientName: String(formData.get("clientName")),
    clientPhone: String(formData.get("clientPhone")),
    clientNotes: formData.get("clientNotes") ? String(formData.get("clientNotes")) : "",
    serviceName: String(formData.get("serviceName")),
    date: String(formData.get("date")),
    slotMinutes: Number(formData.get("slotMinutes") ?? 30),
  });
  if (!res.ok) {
    return { error: res.error };
  }
  revalidatePath(`/book/${String(formData.get("companyId"))}`);
  return { done: true };
}
