import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { assignAdminAction, updateCompanyAction } from "@/actions/companies";
import { ConfirmDeleteCompanyForm } from "@/components/companies/ConfirmDeleteCompanyForm";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";
import * as companyService from "@/lib/services/company.service";

type Search = Promise<{ error?: string; notice?: string }>;

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Search;
}) {
  const { companyId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok || profile.data.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  const company = await companyService.getCompanyForActor(supabase, profile.data, companyId);
  if (!company.ok) {
    notFound();
  }

  const staffCount = await companyService.countProfilesForCompany(supabase, profile.data, companyId);
  const members = staffCount.ok ? staffCount.data : 0;

  const bookUrl =
    typeof process.env.NEXT_PUBLIC_SITE_URL === "string" && process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/book/${companyId}`
      : `/book/${companyId}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/companies" className="text-xs font-semibold uppercase tracking-wide text-[#E9C349]">
            ← Tutte le aziende
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-headline)] text-2xl font-bold text-[#E5E2E1] sm:text-3xl">
            {company.data.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">Gestisci tenant, admin e link pubblico prenotazioni.</p>
        </div>
      </div>

      {sp.error ? (
        <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-200">{sp.error}</p>
      ) : null}
      {sp.notice === "saved" ? (
        <p className="rounded-xl bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">Modifiche salvate.</p>
      ) : null}
      {sp.notice === "admin" ? (
        <p className="rounded-xl bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
          Admin creato o aggiornato: può accedere da /login con email e password impostate.
        </p>
      ) : null}
      {!isSupabaseAdminConfigured() ? (
        <p className="rounded-xl border border-amber-800/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          Manca <code className="text-xs text-[#E9C349]">SUPABASE_SERVICE_ROLE_KEY</code> in{" "}
          <code className="text-xs text-[#E9C349]">.env.local</code>: gli inviti admin non funzionano finché non la aggiungi e riavvii il dev server.{" "}
          <a href="/setup" className="font-semibold text-[#E9C349] underline">
            /setup
          </a>
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dati azienda</CardTitle>
            <CardDescription>Nome commerciale e identificativo.</CardDescription>
          </CardHeader>
          <form action={updateCompanyAction} className="space-y-4">
            <input type="hidden" name="id" value={company.data.id} />
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Nome</label>
              <input
                name="name"
                required
                defaultValue={company.data.name}
                className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
              />
            </div>
            <div className="space-y-1 text-xs text-zinc-500">
              <p>
                <span className="text-zinc-400">ID tenant</span>
              </p>
              <p className="break-all font-mono text-[#E9C349]">{company.data.id}</p>
              <p className="pt-2 text-zinc-400">Creato il {new Date(company.data.created_at).toLocaleString("it-IT")}</p>
              <p className="text-zinc-400">Utenti collegati: {members}</p>
            </div>
            <Button type="submit" className="w-full">
              Salva modifiche
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Link prenotazione pubblica</CardTitle>
            <CardDescription>Condividi con i clienti (stesso host dell’app in produzione).</CardDescription>
          </CardHeader>
          <div className="space-y-3">
            <input
              readOnly
              value={bookUrl}
              className="w-full rounded-xl bg-[#2A2A2A] px-4 py-3 font-mono text-xs text-zinc-300"
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Crea o aggiorna admin</CardTitle>
          <CardDescription>
            Password iniziale scelta da te; l&apos;admin entra da /login con email e questa password (puoi
            reimpostarla qui per lo stesso utente).
          </CardDescription>
        </CardHeader>
        <form action={assignAdminAction} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="companyId" value={company.data.id} />
          <input
            name="name"
            required
            placeholder="Nome admin"
            className="rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2 md:col-span-2"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="Email admin"
            className="rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2 md:col-span-2"
          />
          <PasswordInput
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Password iniziale (min. 6 caratteri)"
            className="w-full md:col-span-2"
          />
          <Button type="submit" className="md:col-span-2" variant="secondary">
            Crea / aggiorna admin
          </Button>
        </form>
      </Card>

      <Card className="border border-red-900/30 bg-red-950/10">
        <CardHeader>
          <CardTitle>Zona pericolosa</CardTitle>
          <CardDescription>Eliminazione consentita solo senza utenti in <code className="text-xs">profiles</code>.</CardDescription>
        </CardHeader>
        <div>
          <ConfirmDeleteCompanyForm companyId={company.data.id} companyName={company.data.name} />
        </div>
      </Card>
    </div>
  );
}
