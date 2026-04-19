import { redirect } from "next/navigation";
import { createLocationAction } from "@/actions/locations";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";
import * as locationService from "@/lib/services/location.service";

type Search = Promise<{ error?: string }>;

export default async function LocationsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok || (profile.data.role !== "ADMIN" && profile.data.role !== "MANAGER")) {
    redirect("/dashboard");
  }
  if (!profile.data.company_id) {
    redirect("/dashboard");
  }
  if (profile.data.role === "MANAGER" && !profile.data.location_id) {
    redirect("/dashboard");
  }

  const list = await locationService.listLocations(supabase, profile.data, profile.data.company_id);
  if (!list.ok) {
    return <p className="text-sm text-red-300">{list.error}</p>;
  }

  const isAdmin = profile.data.role === "ADMIN";

  const bookPath = `/book/${profile.data.company_id}`;
  const siteBase =
    typeof process.env.NEXT_PUBLIC_SITE_URL === "string" && process.env.NEXT_PUBLIC_SITE_URL
      ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
      : "";
  const publicBookUrl = siteBase ? `${siteBase}${bookPath}` : bookPath;

  return (
    <div className="space-y-8">
      {sp.error ? (
        <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-200">{sp.error}</p>
      ) : null}
      <div>
        <h1 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#E5E2E1] sm:text-3xl">
          {isAdmin ? "Filiali" : "La tua sede"}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {isAdmin
            ? "Aggiungi filiali e assegna manager, barber e clienti dalla sede corretta (Team, Clienti, Pagamenti)."
            : "Operi su questa sede: team, clienti, calendario e pagamenti sono riferiti alla tua filiale."}
        </p>
      </div>

      <Card className="border-white/10">
        <CardHeader>
          <CardTitle>Gestione calendario e disponibilità</CardTitle>
          <CardDescription>Link da inviare ai clienti per prenotare online.</CardDescription>
        </CardHeader>
        <div className="px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#2A2A2A]">
            <input
              readOnly
              value={publicBookUrl}
              className="block w-max min-w-full bg-transparent px-3 py-2.5 font-mono text-xs whitespace-nowrap text-[#E5E2E1] outline-none"
            />
          </div>
        </div>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Nuova filiale</CardTitle>
            <CardDescription>Il nome deve essere univoco all’interno dell’azienda.</CardDescription>
          </CardHeader>
          <form action={createLocationAction} className="flex flex-col gap-3 px-0 pb-4 sm:flex-row sm:items-end sm:px-2 sm:pb-6">
            <input type="hidden" name="companyId" value={profile.data.company_id} />
            <input
              name="name"
              required
              placeholder="Nome (es. Centro, Nord, Mall)"
              className="min-w-0 flex-1 rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            />
            <Button type="submit">Aggiungi</Button>
          </form>
        </Card>
      ) : null}

      <Card>
        <ul className="space-y-2 px-0 py-4 text-sm text-zinc-200 sm:px-2 sm:py-6">
          {list.data.map((l) => (
            <li
              key={l.id}
              className="flex flex-col gap-1 rounded-lg bg-[#2A2A2A]/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <span>{l.name}</span>
              <span className="shrink-0 font-mono text-xs text-zinc-500 sm:text-right">{l.id.slice(0, 8)}…</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
