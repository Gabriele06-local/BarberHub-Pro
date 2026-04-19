import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { BusinessKpis } from "@/lib/services/dashboard.service";
import { formatEurIt } from "@/lib/utils/format-currency";

export function BusinessKpisSection({ kpis }: { kpis: BusinessKpis }) {
  const isCompany = kpis.variant === "company";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[#E5E2E1] sm:text-2xl">
          {kpis.headline}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          {isCompany
            ? `${kpis.subline} · Mese solare e giornata in UTC (come i report).`
            : `${kpis.subline} · Solo dati di questa filiale.`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="premium-gradient">
          <CardHeader>
            <CardTitle>Incasso mese</CardTitle>
            <CardDescription>Pagamenti registrati nel mese corrente.</CardDescription>
          </CardHeader>
          <p className="font-[family-name:var(--font-headline)] text-3xl font-black text-[#E9C349] sm:text-4xl">
            {formatEurIt(kpis.revenueMonth)}
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pagamenti mese</CardTitle>
            <CardDescription>Numero di transazioni nel mese.</CardDescription>
          </CardHeader>
          <p className="font-[family-name:var(--font-headline)] text-3xl font-black text-[#E5E2E1] sm:text-4xl">
            {kpis.paymentsCountMonth}
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appuntamenti oggi</CardTitle>
            <CardDescription>
              {isCompany ? "Tutte le sedi, giornata UTC." : "Solo questa sede, giornata UTC."}
            </CardDescription>
          </CardHeader>
          <p className="font-[family-name:var(--font-headline)] text-3xl font-black text-red-500 sm:text-4xl">
            {kpis.appointmentsToday}
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appuntamenti mese</CardTitle>
            <CardDescription>Richieste e conferme nel mese corrente.</CardDescription>
          </CardHeader>
          <p className="font-[family-name:var(--font-headline)] text-3xl font-black text-[#E5E2E1] sm:text-4xl">
            {kpis.appointmentsMonth}
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>In attesa (mese)</CardTitle>
            <CardDescription>Stato pending nel mese corrente.</CardDescription>
          </CardHeader>
          <p className="font-[family-name:var(--font-headline)] text-3xl font-black text-amber-400 sm:text-4xl">
            {kpis.pendingAppointmentsMonth}
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clienti</CardTitle>
            <CardDescription>
              {isCompany ? "Anagrafica attiva in azienda." : "Clienti assegnati a questa sede."}
            </CardDescription>
          </CardHeader>
          <p className="font-[family-name:var(--font-headline)] text-3xl font-black text-[#E5E2E1] sm:text-4xl">
            {kpis.clientsCount}
          </p>
        </Card>

        {isCompany && typeof kpis.locationsCount === "number" ? (
          <Card>
            <CardHeader>
              <CardTitle>Filiali</CardTitle>
              <CardDescription>Punti vendita collegati all&apos;azienda.</CardDescription>
            </CardHeader>
            <p className="font-[family-name:var(--font-headline)] text-3xl font-black text-zinc-300 sm:text-4xl">
              {kpis.locationsCount}
            </p>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
