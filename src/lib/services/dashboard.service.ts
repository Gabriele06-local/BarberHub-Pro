import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, ServiceResult } from "@/types/domain";
import { resolveCompanyScope } from "@/lib/services/scope";

export async function getSuperAdminSummary(
  supabase: SupabaseClient,
  actor: Profile,
): Promise<ServiceResult<{ companies: number }>> {
  if (actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Non autorizzato" };
  }
  const { count, error } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: { companies: count ?? 0 } };
}

export type DashboardSnapshot = {
  revenueMonth: number;
  appointmentsToday: number;
  paymentsCountMonth: number;
};

/** KPI estesi: tutta l’azienda (ADMIN) o singola sede (MANAGER). */
export type BusinessKpis = {
  variant: "company" | "location";
  headline: string;
  subline: string;
  revenueMonth: number;
  paymentsCountMonth: number;
  appointmentsToday: number;
  appointmentsMonth: number;
  pendingAppointmentsMonth: number;
  clientsCount: number;
  /** Solo variant `company`: numero filiali. */
  locationsCount: number | null;
};

export function hasBusinessKpisDashboard(actor: Profile): boolean {
  return (actor.role === "ADMIN" || actor.role === "MANAGER") && !!actor.company_id;
}

export async function getDashboardSnapshot(
  supabase: SupabaseClient,
  actor: Profile,
  companyId?: string | null,
): Promise<ServiceResult<DashboardSnapshot>> {
  const scope = resolveCompanyScope(actor, companyId);
  if (!scope.ok) {
    return scope;
  }

  const now = new Date();
  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  const startDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endDay = new Date(startDay);
  endDay.setUTCDate(endDay.getUTCDate() + 1);

  const paymentsQuery = supabase
    .from("payments")
    .select("amount")
    .eq("company_id", scope.data)
    .gte("date", startMonth.toISOString())
    .lte("date", endMonth.toISOString());

  const apptsQuery = supabase
    .from("appointments")
    .select("id", { count: "exact", head: false })
    .eq("company_id", scope.data)
    .gte("date", startDay.toISOString())
    .lt("date", endDay.toISOString());

  const [{ data: payRows, error: payErr }, { data: apptRows, error: apErr }] = await Promise.all([
    paymentsQuery,
    actor.role === "BARBER"
      ? apptsQuery.eq("barber_id", actor.id)
      : apptsQuery,
  ]);

  if (payErr) {
    return { ok: false, error: payErr.message };
  }
  if (apErr) {
    return { ok: false, error: apErr.message };
  }

  const revenueMonth = (payRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const paymentsCountMonth = payRows?.length ?? 0;
  const appointmentsToday = apptRows?.length ?? 0;

  return {
    ok: true,
    data: { revenueMonth, appointmentsToday, paymentsCountMonth },
  };
}

export async function getBusinessKpis(
  supabase: SupabaseClient,
  actor: Profile,
): Promise<ServiceResult<BusinessKpis>> {
  if (actor.role !== "ADMIN" && actor.role !== "MANAGER") {
    return { ok: false, error: "Ruolo non supportato per i KPI estesi" };
  }
  if (!actor.company_id) {
    return { ok: false, error: "Azienda non associata" };
  }
  if (actor.role === "MANAGER" && !actor.location_id) {
    return { ok: false, error: "Sede non assegnata al profilo" };
  }

  const now = new Date();
  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const startDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endDay = new Date(startDay);
  endDay.setUTCDate(endDay.getUTCDate() + 1);

  const cid = actor.company_id;
  const lid = actor.location_id;

  if (actor.role === "ADMIN") {
    const payQ = supabase
      .from("payments")
      .select("amount")
      .eq("company_id", cid)
      .gte("date", startMonth.toISOString())
      .lte("date", endMonth.toISOString());
    const apTodayQ = supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("company_id", cid)
      .gte("date", startDay.toISOString())
      .lt("date", endDay.toISOString());
    const apMonthQ = supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("company_id", cid)
      .gte("date", startMonth.toISOString())
      .lte("date", endMonth.toISOString());
    const apPendingQ = supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("company_id", cid)
      .eq("status", "pending")
      .gte("date", startMonth.toISOString())
      .lte("date", endMonth.toISOString());
    const clientsQ = supabase.from("clients").select("id", { count: "exact", head: true }).eq("company_id", cid);
    const locsQ = supabase.from("locations").select("id", { count: "exact", head: true }).eq("company_id", cid);
    const companyQ = supabase.from("companies").select("name").eq("id", cid).maybeSingle();

    const [payRes, atRes, amRes, apRes, clRes, loRes, coRes] = await Promise.all([
      payQ,
      apTodayQ,
      apMonthQ,
      apPendingQ,
      clientsQ,
      locsQ,
      companyQ,
    ]);

    if (payRes.error) return { ok: false, error: payRes.error.message };
    if (atRes.error) return { ok: false, error: atRes.error.message };
    if (amRes.error) return { ok: false, error: amRes.error.message };
    if (apRes.error) return { ok: false, error: apRes.error.message };
    if (clRes.error) return { ok: false, error: clRes.error.message };
    if (loRes.error) return { ok: false, error: loRes.error.message };

    const revenueMonth = (payRes.data ?? []).reduce((s, r) => s + Number((r as { amount: unknown }).amount), 0);
    const paymentsCountMonth = payRes.data?.length ?? 0;

    return {
      ok: true,
      data: {
        variant: "company",
        headline: "KPI aziendali",
        subline: coRes.data?.name ? String(coRes.data.name) : "Tutte le sedi aggregate",
        revenueMonth,
        paymentsCountMonth,
        appointmentsToday: atRes.count ?? 0,
        appointmentsMonth: amRes.count ?? 0,
        pendingAppointmentsMonth: apRes.count ?? 0,
        clientsCount: clRes.count ?? 0,
        locationsCount: loRes.count ?? 0,
      },
    };
  }

  /* MANAGER: sede */
  const payQ = supabase
    .from("payments")
    .select("amount")
    .eq("company_id", cid)
    .eq("location_id", lid!)
    .gte("date", startMonth.toISOString())
    .lte("date", endMonth.toISOString());
  const apTodayQ = supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("company_id", cid)
    .eq("location_id", lid!)
    .gte("date", startDay.toISOString())
    .lt("date", endDay.toISOString());
  const apMonthQ = supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("company_id", cid)
    .eq("location_id", lid!)
    .gte("date", startMonth.toISOString())
    .lte("date", endMonth.toISOString());
  const apPendingQ = supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("company_id", cid)
    .eq("location_id", lid!)
    .eq("status", "pending")
    .gte("date", startMonth.toISOString())
    .lte("date", endMonth.toISOString());
  const clientsQ = supabase.from("clients").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("location_id", lid!);
  const locQ = supabase.from("locations").select("name").eq("id", lid!).maybeSingle();

  const [payRes, atRes, amRes, apRes, clRes, locRes] = await Promise.all([
    payQ,
    apTodayQ,
    apMonthQ,
    apPendingQ,
    clientsQ,
    locQ,
  ]);

  if (payRes.error) return { ok: false, error: payRes.error.message };
  if (atRes.error) return { ok: false, error: atRes.error.message };
  if (amRes.error) return { ok: false, error: amRes.error.message };
  if (apRes.error) return { ok: false, error: apRes.error.message };
  if (clRes.error) return { ok: false, error: clRes.error.message };
  if (locRes.error) return { ok: false, error: locRes.error.message };

  const revenueMonth = (payRes.data ?? []).reduce((s, r) => s + Number((r as { amount: unknown }).amount), 0);
  const paymentsCountMonth = payRes.data?.length ?? 0;
  const locName = locRes.data?.name ? String(locRes.data.name) : "Sede";

  return {
    ok: true,
    data: {
      variant: "location",
      headline: "KPI sede",
      subline: locName,
      revenueMonth,
      paymentsCountMonth,
      appointmentsToday: atRes.count ?? 0,
      appointmentsMonth: amRes.count ?? 0,
      pendingAppointmentsMonth: apRes.count ?? 0,
      clientsCount: clRes.count ?? 0,
      locationsCount: null,
    },
  };
}
