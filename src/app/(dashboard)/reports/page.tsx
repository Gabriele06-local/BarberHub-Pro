import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/server";
import { canManagePayments } from "@/lib/services/scope";
import * as authService from "@/lib/services/auth.service";
import * as reportService from "@/lib/services/report.service";
import { formatEurIt } from "@/lib/utils/format-currency";

const MONTH_NAMES_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

const METHOD_LABEL: Record<string, string> = {
  cash: "Contanti",
  srl: "SRL",
  privato: "Privato",
};

type Search = Promise<{ year?: string; q?: string }>;

function parseYear(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 2000 || n > 2100) {
    return fallback;
  }
  return n;
}

export default async function ReportsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  if (!canManagePayments(profile.data)) {
    redirect("/dashboard");
  }

  const defaultYear = new Date().getUTCFullYear();
  const year = parseYear(sp.year, defaultYear);
  const q = typeof sp.q === "string" ? sp.q : "";

  const report = await reportService.getGlobalReport(supabase, profile.data, {
    year,
    search: q.trim() || undefined,
  });

  if (!report.ok) {
    return <p className="text-sm text-red-300">{report.error}</p>;
  }

  const { months, yearTotals, paymentLines } = report.data;
  const isPlatform = profile.data.role === "SUPER_ADMIN";
  const yearOptions = Array.from({ length: 5 }, (_, i) => defaultYear - 2 + i);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#E5E2E1] sm:text-3xl">
          Report globali
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {isPlatform
            ? "Tutte le sedi: ogni riga di aggregazione considera tutte le aziende onboardate."
            : "La tua sede: tutti i punti vendita contano come location distinte sui pagamenti."}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-xl">Andamento annuale</CardTitle>
            <CardDescription>
              Totali per metodo di pagamento e sedi attive
              {isPlatform ? " (n. aziende con incasso nel mese)" : " (n. punti vendita / location distinti)"}.
            </CardDescription>
          </div>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Anno</label>
              <select
                name="year"
                defaultValue={year}
                className="rounded-xl bg-[#353534] px-4 py-2.5 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            {q ? <input type="hidden" name="q" value={q} /> : null}
            <Button type="submit" variant="secondary">
              Aggiorna
            </Button>
          </form>
        </CardHeader>

        <div className="overflow-x-auto px-0 pb-4 sm:px-2 sm:pb-6">
          <Table>
            <THead>
              <Tr>
                <Th>Mese</Th>
                <Th>Totale</Th>
                <Th>Contanti</Th>
                <Th>SRL</Th>
                <Th>Privato</Th>
                <Th>Sedi attive</Th>
              </Tr>
            </THead>
            <TBody>
              {months.map((row) => (
                <Tr key={row.month}>
                  <Td className="font-medium text-[#E5E2E1]">{MONTH_NAMES_IT[row.month - 1]}</Td>
                  <Td>{formatEurIt(row.total)}</Td>
                  <Td>{formatEurIt(row.cash)}</Td>
                  <Td>{formatEurIt(row.srl)}</Td>
                  <Td>{formatEurIt(row.privato)}</Td>
                  <Td>{row.activeSites}</Td>
                </Tr>
              ))}
              <Tr className="border-t border-[#E9C349]/30 bg-[#2A2A2A]/50 font-semibold">
                <Td className="text-[#E9C349]">TOT ANNO GLOBALE</Td>
                <Td className="text-[#E5E2E1]">{formatEurIt(yearTotals.total)}</Td>
                <Td>{formatEurIt(yearTotals.cash)}</Td>
                <Td>{formatEurIt(yearTotals.srl)}</Td>
                <Td>{formatEurIt(yearTotals.privato)}</Td>
                <Td>{yearTotals.activeSitesYear}</Td>
              </Tr>
            </TBody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cerca cliente</CardTitle>
          <CardDescription>Nome, cognome o come salvato in anagrafica — filtra i movimenti dell&apos;anno.</CardDescription>
        </CardHeader>
        <form method="get" className="flex flex-col gap-3 px-0 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-2">
          <input type="hidden" name="year" value={year} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Nome, cognome o nickname…"
            className="min-w-0 w-full flex-1 rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2 sm:min-w-[200px]"
          />
          <Button type="submit">Cerca</Button>
          {q ? (
            <Link
              href={`/reports?year=${year}`}
              className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold text-[#E9C349] hover:underline"
            >
              Azzera
            </Link>
          ) : null}
        </form>

        <div className="overflow-x-auto px-0 pb-4 sm:px-2 sm:pb-6">
          <Table>
            <THead>
              <Tr>
                <Th className="w-12">#</Th>
                <Th>Cliente</Th>
                <Th>Sede</Th>
                <Th>Importo</Th>
                <Th>Categoria</Th>
                <Th>Data</Th>
                <Th>Metodo</Th>
                <Th className="text-right">Azioni</Th>
              </Tr>
            </THead>
            <TBody>
              {paymentLines.length === 0 ? (
                <Tr>
                  <Td colSpan={8} className="text-center text-sm text-zinc-500">
                    Nessun movimento in questo anno{q ? " per la ricerca indicata" : ""}.
                  </Td>
                </Tr>
              ) : (
                paymentLines.map((row, idx) => (
                  <Tr key={row.id}>
                    <Td className="text-zinc-500">{idx + 1}</Td>
                    <Td className="font-medium">{row.clientName}</Td>
                    <Td>
                      {isPlatform ? (
                        <span className="text-zinc-200">{row.companyName}</span>
                      ) : (
                        <>
                          <span className="text-zinc-200">{row.location}</span>
                          <span className="mt-0.5 block text-xs text-zinc-500">{row.companyName}</span>
                        </>
                      )}
                    </Td>
                    <Td>{formatEurIt(row.amount)}</Td>
                    <Td>{row.category}</Td>
                    <Td className="whitespace-nowrap text-xs text-zinc-400">
                      {new Date(row.date).toLocaleString("it-IT", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Td>
                    <Td>
                      <Badge tone="gold" className="normal-case">
                        {METHOD_LABEL[row.method] ?? row.method}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      {isPlatform ? (
                        <Link
                          href={`/companies/${row.companyId}`}
                          className="text-sm font-semibold text-[#E9C349] hover:underline"
                        >
                          Scheda sede
                        </Link>
                      ) : (
                        <Link href="/payments" className="text-sm font-semibold text-[#E9C349] hover:underline">
                          Pagamenti
                        </Link>
                      )}
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
