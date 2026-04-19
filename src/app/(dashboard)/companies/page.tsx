import Link from "next/link";
import { redirect } from "next/navigation";
import { assignAdminAction, createCompanyAction } from "@/actions/companies";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";
import * as companyService from "@/lib/services/company.service";

type Search = Promise<{ error?: string; notice?: string }>;

export default async function CompaniesPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok || profile.data.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  const list = await companyService.listCompanies(supabase, profile.data);
  if (!list.ok) {
    return <p className="text-sm text-red-300">{list.error}</p>;
  }

  return (
    <div className="space-y-8">
      {sp.error ? (
        <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-200">{sp.error}</p>
      ) : null}
      {sp.notice === "deleted" ? (
        <p className="rounded-xl bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">Azienda eliminata.</p>
      ) : null}
      {!isSupabaseAdminConfigured() ? (
        <p className="rounded-xl border border-amber-800/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          Per invitare admin serve <code className="text-xs text-[#E9C349]">SUPABASE_SERVICE_ROLE_KEY</code> in{" "}
          <code className="text-xs text-[#E9C349]">.env.local</code> (Supabase → Settings → API). Solo server, mai nel browser. Poi riavvia{" "}
          <code className="text-xs text-[#E9C349]">npm run dev</code>. Istruzioni anche in{" "}
          <a href="/setup" className="font-semibold text-[#E9C349] underline">
            /setup
          </a>
          .
        </p>
      ) : null}
      <div>
        <h1 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#E5E2E1] sm:text-3xl">
          Aziende
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Crea tenant e assegna un admin per ogni barber shop.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nuova azienda</CardTitle>
            <CardDescription>Nome commerciale visibile nel pannello.</CardDescription>
          </CardHeader>
          <form action={createCompanyAction} className="space-y-4">
            <input
              name="name"
              required
              placeholder="Nome azienda"
              className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            />
            <Button type="submit" className="w-full">
              Crea azienda
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assegna admin</CardTitle>
            <CardDescription>
              Crea l&apos;utente Auth con la password iniziale che comunichi al barber shop (minimo 6 caratteri).
            </CardDescription>
          </CardHeader>
          <form action={assignAdminAction} className="space-y-3">
            <select
              name="companyId"
              required
              className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            >
              <option value="">Seleziona azienda</option>
              {list.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              name="name"
              required
              placeholder="Nome admin"
              className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            />
            <input
              name="email"
              type="email"
              required
              placeholder="Email admin"
              className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            />
            <PasswordInput
              name="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Password iniziale (min. 6 caratteri)"
              className="w-full"
            />
            <Button type="submit" className="w-full" variant="secondary">
              Crea / aggiorna admin
            </Button>
          </form>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco</CardTitle>
          <CardDescription>ID utilizzabile nel link pubblico /book/[company_id].</CardDescription>
        </CardHeader>
        <Table>
          <THead>
            <Tr>
              <Th>Nome</Th>
              <Th>ID</Th>
              <Th>Creato</Th>
              <Th className="text-right">Azioni</Th>
            </Tr>
          </THead>
          <TBody>
            {list.data.map((c) => (
              <Tr key={c.id}>
                <Td className="font-medium">{c.name}</Td>
                <Td className="font-mono text-xs text-zinc-400">{c.id}</Td>
                <Td className="text-xs text-zinc-400">{new Date(c.created_at).toLocaleString("it-IT")}</Td>
                <Td className="text-right">
                  <Link
                    href={`/companies/${c.id}`}
                    className="text-sm font-semibold text-[#E9C349] hover:underline"
                  >
                    Gestisci
                  </Link>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
