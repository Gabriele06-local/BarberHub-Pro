import { BusinessKpisSection } from "@/components/dashboard/BusinessKpisSection";
import { DashboardHubClient } from "@/components/dashboard/DashboardHubClient";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";
import * as clientService from "@/lib/services/client.service";
import * as companyService from "@/lib/services/company.service";
import * as dashboardService from "@/lib/services/dashboard.service";
import * as paymentService from "@/lib/services/payment.service";

type DashboardSearch = Promise<{ error?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams?: DashboardSearch }) {
  const sp = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    return null;
  }

  if (profile.data.role === "SUPER_ADMIN") {
    const summary = await dashboardService.getSuperAdminSummary(supabase, profile.data);
    const companies = summary.ok ? await companyService.listCompanies(supabase, profile.data) : null;
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-[family-name:var(--font-headline)] text-2xl font-bold tracking-tight text-[#E5E2E1] sm:text-3xl">
            Control room
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Gestisci i tenant collegati alla piattaforma BarberHub Pro.
          </p>
        </div>
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          <Card className="premium-gradient">
            <CardHeader>
              <CardTitle>Aziende attive</CardTitle>
              <CardDescription>Numero totale di barber shop onboardati.</CardDescription>
            </CardHeader>
            <p className="font-[family-name:var(--font-headline)] text-4xl font-black text-[#E9C349]">
              {summary.ok ? summary.data.companies : "—"}
            </p>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Accesso rapido</CardTitle>
              <CardDescription>Crea nuove aziende o assegna admin dal menu laterale.</CardDescription>
            </CardHeader>
            <ul className="space-y-2 text-sm text-zinc-300">
              {(companies?.ok ? companies.data : []).slice(0, 4).map((c) => (
                <li key={c.id} className="flex justify-between gap-4">
                  <span>{c.name}</span>
                  <span className="text-xs text-zinc-500">{c.id.slice(0, 8)}…</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    );
  }

  const showBizKpis = dashboardService.hasBusinessKpisDashboard(profile.data);
  const bizKpis = showBizKpis ? await dashboardService.getBusinessKpis(supabase, profile.data) : null;
  const snap =
    !showBizKpis && profile.data.company_id
      ? await dashboardService.getDashboardSnapshot(supabase, profile.data, profile.data.company_id)
      : null;

  if (showBizKpis && bizKpis && !bizKpis.ok) {
    return <p className="text-sm text-red-300">{bizKpis.error}</p>;
  }
  if (!showBizKpis && snap && !snap.ok) {
    return <p className="text-sm text-red-300">{snap.error}</p>;
  }

  const cid = profile.data.company_id;
  const showHub =
    cid &&
    (profile.data.role === "ADMIN" || profile.data.role === "MANAGER");

  const hubClients = showHub
    ? await clientService.listClientsWithLastBooking(supabase, profile.data, cid)
    : null;
  const recentPayments = showHub
    ? await paymentService.listRecentPayments(supabase, profile.data, { companyId: cid, limit: 12 })
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-headline)] text-2xl font-bold tracking-tight text-[#E5E2E1] sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {showBizKpis && bizKpis?.ok
            ? bizKpis.data.variant === "company"
              ? "Panoramica economica e operativa su tutta l’azienda."
              : "Panoramica economica e operativa sulla tua filiale."
            : showHub
              ? "Metriche, clienti, pagamenti e ultima prenotazione in un’unica vista."
              : "Metriche operative (solo i tuoi appuntamenti)."}
        </p>
      </div>

      {bizKpis?.ok ? (
        <BusinessKpisSection kpis={bizKpis.data} />
      ) : snap?.ok ? (
        <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
          <Card className="premium-gradient">
            <CardHeader>
              <CardTitle>Incasso mese</CardTitle>
              <CardDescription>Pagamenti registrati nel mese corrente.</CardDescription>
            </CardHeader>
            <p className="font-[family-name:var(--font-headline)] text-4xl font-black text-[#E9C349]">
              € {snap.data.revenueMonth.toFixed(2)}
            </p>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Appuntamenti oggi</CardTitle>
              <CardDescription>
                {profile.data.role === "BARBER" ? "Solo i tuoi slot." : "Tutti gli slot della sede."}
              </CardDescription>
            </CardHeader>
            <p className="font-[family-name:var(--font-headline)] text-4xl font-black text-red-500">
              {snap.data.appointmentsToday}
            </p>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pagamenti mese</CardTitle>
              <CardDescription>Numero di transazioni registrate.</CardDescription>
            </CardHeader>
            <p className="font-[family-name:var(--font-headline)] text-4xl font-black text-[#E5E2E1]">
              {snap.data.paymentsCountMonth}
            </p>
          </Card>
        </div>
      ) : null}

      {showHub && hubClients?.ok ? (
        <DashboardHubClient
          companyId={cid!}
          clients={hubClients.data}
          recentPayments={recentPayments?.ok ? recentPayments.data : []}
          error={
            typeof sp.error === "string"
              ? sp.error
              : recentPayments && !recentPayments.ok
                ? recentPayments.error
                : undefined
          }
        />
      ) : showHub && hubClients && !hubClients.ok ? (
        <p className="text-sm text-red-300">{hubClients.error}</p>
      ) : null}
    </div>
  );
}
