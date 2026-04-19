"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";
import * as locationOpenSlotsService from "@/lib/services/location-open-slots.service";
import type { LocationOpenSlotRow } from "@/lib/services/location-open-slots.service";
import type { ExpandedOpenSlotInsert } from "@/lib/booking/expand-public-slots";

export async function loadLocationOpenSlotsAction(input: {
  companyId: string;
  locationId: string;
  slotDate: string;
}): Promise<{ ok: true; mins: number[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    return { ok: false, error: profile.error };
  }
  const res = await locationOpenSlotsService.listLocationOpenSlots(
    supabase,
    profile.data,
    input.companyId,
    input.locationId,
    input.slotDate,
  );
  if (!res.ok) {
    return { ok: false, error: res.error };
  }
  return { ok: true, mins: res.data };
}

export async function loadLocationOpenSlotsRangeAction(input: {
  companyId: string;
  locationId: string;
  dateFrom: string;
  dateTo: string;
}): Promise<{ ok: true; rows: LocationOpenSlotRow[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    return { ok: false, error: profile.error };
  }
  const res = await locationOpenSlotsService.listLocationOpenSlotsInRange(
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

export async function saveLocationOpenSlotsAction(input: {
  companyId: string;
  locationId: string;
  slotDate: string;
  slotMins: number[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    return { ok: false, error: profile.error };
  }
  const res = await locationOpenSlotsService.replaceLocationOpenSlots(supabase, profile.data, input);
  if (!res.ok) {
    return { ok: false, error: res.error };
  }
  revalidatePath("/calendar");
  revalidatePath(`/book/${input.companyId}`);
  return { ok: true };
}

export async function insertPublicSlotRowsAction(input: {
  companyId: string;
  locationId: string;
  rows: ExpandedOpenSlotInsert[];
}): Promise<{ ok: true; inserted: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    return { ok: false, error: profile.error };
  }
  const res = await locationOpenSlotsService.insertLocationOpenSlotRows(
    supabase,
    profile.data,
    input.companyId,
    input.locationId,
    input.rows,
  );
  if (!res.ok) {
    return { ok: false, error: res.error };
  }
  revalidatePath("/calendar");
  revalidatePath(`/book/${input.companyId}`);
  return { ok: true, inserted: res.data };
}

export async function deletePublicSlotIdsAction(input: {
  companyId: string;
  locationId: string;
  ids: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    return { ok: false, error: profile.error };
  }
  const res = await locationOpenSlotsService.deleteLocationOpenSlotsByIds(
    supabase,
    profile.data,
    input.companyId,
    input.locationId,
    input.ids,
  );
  if (!res.ok) {
    return { ok: false, error: res.error };
  }
  revalidatePath("/calendar");
  revalidatePath(`/book/${input.companyId}`);
  return { ok: true };
}
