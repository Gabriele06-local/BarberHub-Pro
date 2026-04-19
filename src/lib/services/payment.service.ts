import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Payment, Profile, ServiceResult } from "@/types/domain";
import { paymentUpsertSchema } from "@/lib/validation/schemas";
import { canManagePayments, resolveCompanyScope } from "@/lib/services/scope";

export type PaymentListRow = Payment & {
  client?: { name: string } | null;
  location?: { name: string } | null;
};

export async function listPaymentsInRange(
  supabase: SupabaseClient,
  actor: Profile,
  params: { companyId?: string | null; from: string; to: string },
): Promise<ServiceResult<PaymentListRow[]>> {
  if (!canManagePayments(actor)) {
    return { ok: false, error: "Non autorizzato" };
  }
  const scope = resolveCompanyScope(actor, params.companyId);
  if (!scope.ok) {
    return scope;
  }
  const { data, error } = await supabase
    .from("payments")
    .select("*,client:clients(name),location:locations(name)")
    .eq("company_id", scope.data)
    .gte("date", params.from)
    .lte("date", params.to)
    .order("date", { ascending: false });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data as PaymentListRow[] };
}

export async function listRecentPayments(
  supabase: SupabaseClient,
  actor: Profile,
  params: { companyId: string; limit?: number },
): Promise<ServiceResult<PaymentListRow[]>> {
  if (!canManagePayments(actor)) {
    return { ok: false, error: "Non autorizzato" };
  }
  const scope = resolveCompanyScope(actor, params.companyId);
  if (!scope.ok) {
    return scope;
  }
  const lim = Math.min(Math.max(params.limit ?? 12, 1), 50);
  const { data, error } = await supabase
    .from("payments")
    .select("*,client:clients(name),location:locations(name)")
    .eq("company_id", scope.data)
    .order("date", { ascending: false })
    .limit(lim);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data as PaymentListRow[] };
}

export async function upsertPayment(
  supabase: SupabaseClient,
  actor: Profile,
  input: unknown,
): Promise<ServiceResult<Payment>> {
  if (!canManagePayments(actor)) {
    return { ok: false, error: "Non autorizzato" };
  }
  const parsed = paymentUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dati pagamento non validi" };
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
    .select("location_id")
    .eq("id", parsed.data.clientId)
    .eq("company_id", scope.data)
    .maybeSingle();
  if (cErr || !clientRow?.location_id) {
    return { ok: false, error: cErr?.message ?? "Cliente non trovato o senza sede assegnata" };
  }
  const clientLocationId = clientRow.location_id as string;

  let locationId: string;
  if (actor.role === "MANAGER") {
    locationId = actor.location_id ?? "";
    if (!locationId) {
      return { ok: false, error: "Sede non assegnata al profilo" };
    }
  } else {
    locationId = parsed.data.locationId ?? clientLocationId;
  }

  if (clientLocationId !== locationId) {
    return { ok: false, error: "Il cliente non appartiene alla sede del pagamento" };
  }

  const { data: locRow, error: locErr } = await supabase
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .eq("company_id", scope.data)
    .maybeSingle();
  if (locErr) {
    return { ok: false, error: locErr.message };
  }
  if (!locRow) {
    return { ok: false, error: "Sede non valida" };
  }

  const row = {
    company_id: scope.data,
    client_id: parsed.data.clientId,
    location_id: locationId,
    amount: parsed.data.amount,
    category: parsed.data.category,
    method: parsed.data.method,
    date: parsed.data.date,
  };

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("payments")
      .update(row)
      .eq("id", parsed.data.id)
      .eq("company_id", scope.data)
      .select("*")
      .single();
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, data: data as Payment };
  }

  const { data, error } = await supabase.from("payments").insert(row).select("*").single();
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data as Payment };
}

export async function deletePayment(
  supabase: SupabaseClient,
  actor: Profile,
  params: { id: string; companyId?: string | null },
): Promise<ServiceResult<null>> {
  if (!canManagePayments(actor)) {
    return { ok: false, error: "Non autorizzato" };
  }
  const scope = resolveCompanyScope(actor, params.companyId);
  if (!scope.ok) {
    return scope;
  }
  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", params.id)
    .eq("company_id", scope.data);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}
