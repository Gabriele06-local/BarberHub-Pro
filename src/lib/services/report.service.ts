import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, ServiceResult } from "@/types/domain";
import type { PaymentMethod } from "@/types/domain";
import type {
  AnnualReportRow,
  GlobalReportMonthRow,
  GlobalReportPayload,
  GlobalReportPaymentRow,
  MonthlyReport,
  MonthlyReportRow,
} from "@/types/reports";
import { reportMonthSchema, reportYearSchema } from "@/lib/validation/schemas";
import { canManagePayments, resolveCompanyScope } from "@/lib/services/scope";

export type {
  AnnualReportRow,
  GlobalReportMonthRow,
  GlobalReportPayload,
  GlobalReportPaymentRow,
  MonthlyReport,
  MonthlyReportRow,
} from "@/types/reports";

function monthRange(year: number, month: number) {
  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { from: from.toISOString(), to: to.toISOString() };
}

function yearRange(year: number) {
  const from = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
  const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  return { from: from.toISOString(), to: to.toISOString() };
}

export async function getMonthlyReport(
  supabase: SupabaseClient,
  actor: Profile,
  input: unknown,
): Promise<ServiceResult<MonthlyReport>> {
  if (!canManagePayments(actor)) {
    return { ok: false, error: "Non autorizzato" };
  }
  const parsed = reportMonthSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Parametri report non validi" };
  }
  const scope = resolveCompanyScope(actor, parsed.data.companyId);
  if (!scope.ok) {
    return scope;
  }
  const { from, to } = monthRange(parsed.data.year, parsed.data.month);

  const { data, error } = await supabase
    .from("payments")
    .select("id,amount,category,method,date,client:clients(name),location:locations(name)")
    .eq("company_id", scope.data)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows: MonthlyReportRow[] = (data ?? []).map((p) => {
    const rel = p.client as { name: string } | { name: string }[] | null | undefined;
    const clientName = Array.isArray(rel) ? rel[0]?.name : rel?.name;
    const locRel = p.location as { name: string } | { name: string }[] | null | undefined;
    const locName = Array.isArray(locRel) ? locRel[0]?.name : locRel?.name;
    return {
      id: p.id as string,
      clientName: clientName ?? "—",
      location: locName ?? "—",
      amount: Number(p.amount),
      category: p.category as string,
      date: p.date as string,
      method: p.method as PaymentMethod,
    };
  });

  const totalRevenue = rows.reduce((s, r) => s + r.amount, 0);
  const paymentCount = rows.length;
  const averageTicket = paymentCount ? totalRevenue / paymentCount : 0;

  const methodBreakdownMap = new Map<PaymentMethod, number>();
  for (const r of rows) {
    methodBreakdownMap.set(r.method, (methodBreakdownMap.get(r.method) ?? 0) + r.amount);
  }
  const methodBreakdown = (["cash", "srl", "privato"] as PaymentMethod[]).map((method) => ({
    method,
    total: methodBreakdownMap.get(method) ?? 0,
  }));

  return {
    ok: true,
    data: {
      rows,
      kpis: { totalRevenue, paymentCount, averageTicket },
      methodBreakdown,
    },
  };
}

export async function getAnnualReport(
  supabase: SupabaseClient,
  actor: Profile,
  input: unknown,
): Promise<ServiceResult<AnnualReportRow[]>> {
  if (!canManagePayments(actor)) {
    return { ok: false, error: "Non autorizzato" };
  }
  const parsed = reportYearSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Parametri report non validi" };
  }
  const scope = resolveCompanyScope(actor, parsed.data.companyId);
  if (!scope.ok) {
    return scope;
  }
  const { from, to } = yearRange(parsed.data.year);

  const { data, error } = await supabase
    .from("payments")
    .select("amount,method,date,location_id")
    .eq("company_id", scope.data)
    .gte("date", from)
    .lte("date", to);

  if (error) {
    return { ok: false, error: error.message };
  }

  const byMonth = new Map<
    number,
    { total: number; cash: number; srl: number; privato: number; locations: Set<string> }
  >();

  for (let m = 1; m <= 12; m++) {
    byMonth.set(m, { total: 0, cash: 0, srl: 0, privato: 0, locations: new Set() });
  }

  for (const p of data ?? []) {
    const d = new Date(p.date as string);
    const m = d.getUTCMonth() + 1;
    const bucket = byMonth.get(m)!;
    const amt = Number(p.amount);
    bucket.total += amt;
    if (p.method === "cash") {
      bucket.cash += amt;
    } else if (p.method === "srl") {
      bucket.srl += amt;
    } else {
      bucket.privato += amt;
    }
    if (p.location_id) {
      bucket.locations.add(p.location_id as string);
    }
  }

  const rows: AnnualReportRow[] = Array.from(byMonth.entries())
    .sort(([a], [b]) => a - b)
    .map(([month, v]) => ({
      month,
      total: v.total,
      cash: v.cash,
      srl: v.srl,
      privato: v.privato,
      activeLocations: v.locations.size,
    }));

  return { ok: true, data: rows };
}

function isGlobalReportActor(actor: Profile): boolean {
  return (
    actor.role === "SUPER_ADMIN" ||
    actor.role === "ADMIN" ||
    actor.role === "MANAGER"
  );
}

/**
 * Report annuale unificato: SUPER_ADMIN su tutte le aziende; ADMIN/MANAGER sulla propria.
 * `activeSites`: per SUPER = n. aziende distinte con incasso nel mese; per tenant = n. sedi (`location_id`) distinte.
 */
export async function getGlobalReport(
  supabase: SupabaseClient,
  actor: Profile,
  input: { year: number; search?: string },
): Promise<ServiceResult<GlobalReportPayload>> {
  if (!canManagePayments(actor) || !isGlobalReportActor(actor)) {
    return { ok: false, error: "Non autorizzato" };
  }

  const year = Math.floor(Number(input.year));
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return { ok: false, error: "Anno non valido" };
  }

  if (actor.role !== "SUPER_ADMIN" && !actor.company_id) {
    return { ok: false, error: "Azienda non associata" };
  }

  const { from, to } = yearRange(year);
  const siteMode = actor.role === "SUPER_ADMIN" ? "company" : "location";

  let payQuery = supabase
    .from("payments")
    .select("id,amount,category,method,date,location_id,company_id,client:clients(name),location:locations(name)")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false });

  if (actor.role !== "SUPER_ADMIN") {
    payQuery = payQuery.eq("company_id", actor.company_id as string);
  }

  const { data: payRows, error: payErr } = await payQuery;
  if (payErr) {
    return { ok: false, error: payErr.message };
  }

  const rows = payRows ?? [];
  const companyIds = [...new Set(rows.map((r) => r.company_id as string).filter(Boolean))];
  const companyNameById = new Map<string, string>();
  if (companyIds.length) {
    const { data: companies, error: cErr } = await supabase
      .from("companies")
      .select("id,name")
      .in("id", companyIds);
    if (cErr) {
      return { ok: false, error: cErr.message };
    }
    for (const c of companies ?? []) {
      companyNameById.set(c.id as string, String(c.name ?? ""));
    }
  }

  const byMonth = new Map<
    number,
    { total: number; cash: number; srl: number; privato: number; sites: Set<string> }
  >();
  for (let m = 1; m <= 12; m++) {
    byMonth.set(m, { total: 0, cash: 0, srl: 0, privato: 0, sites: new Set() });
  }

  const yearCompanyIds = new Set<string>();
  const yearLocations = new Set<string>();

  for (const p of rows) {
    const d = new Date(p.date as string);
    const m = d.getUTCMonth() + 1;
    const bucket = byMonth.get(m)!;
    const amt = Number(p.amount);
    bucket.total += amt;
    if (p.method === "cash") {
      bucket.cash += amt;
    } else if (p.method === "srl") {
      bucket.srl += amt;
    } else {
      bucket.privato += amt;
    }
    if (siteMode === "company" && p.company_id) {
      if (amt > 0) {
        bucket.sites.add(p.company_id as string);
        yearCompanyIds.add(p.company_id as string);
      }
    } else if (siteMode === "location" && p.location_id) {
      if (amt > 0) {
        bucket.sites.add(p.location_id as string);
        yearLocations.add(p.location_id as string);
      }
    }
  }

  const months: GlobalReportMonthRow[] = Array.from(byMonth.entries())
    .sort(([a], [b]) => a - b)
    .map(([month, v]) => ({
      month,
      total: v.total,
      cash: v.cash,
      srl: v.srl,
      privato: v.privato,
      activeSites: v.sites.size,
    }));

  const yearTotals = {
    total: months.reduce((s, r) => s + r.total, 0),
    cash: months.reduce((s, r) => s + r.cash, 0),
    srl: months.reduce((s, r) => s + r.srl, 0),
    privato: months.reduce((s, r) => s + r.privato, 0),
    activeSitesYear: siteMode === "company" ? yearCompanyIds.size : yearLocations.size,
  };

  const search = input.search?.trim().toLowerCase() ?? "";
  const paymentLinesRaw: GlobalReportPaymentRow[] = rows.map((p) => {
    const rel = p.client as { name: string } | { name: string }[] | null | undefined;
    const clientName = Array.isArray(rel) ? rel[0]?.name : rel?.name;
    const locRel = p.location as { name: string } | { name: string }[] | null | undefined;
    const locName = Array.isArray(locRel) ? locRel[0]?.name : locRel?.name;
    const cid = p.company_id as string;
    return {
      id: p.id as string,
      clientName: clientName ?? "—",
      companyId: cid,
      companyName: companyNameById.get(cid) ?? "—",
      location: locName ?? "—",
      amount: Number(p.amount),
      category: p.category as string,
      date: p.date as string,
      method: p.method as PaymentMethod,
    };
  });

  const paymentLines = search
    ? paymentLinesRaw.filter((r) => r.clientName.toLowerCase().includes(search))
    : paymentLinesRaw;

  return {
    ok: true,
    data: {
      months,
      yearTotals,
      paymentLines,
    },
  };
}
