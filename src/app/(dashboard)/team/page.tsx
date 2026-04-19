import { redirect } from "next/navigation";
import { inviteTeamMemberAction } from "@/actions/team";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import * as authService from "@/lib/services/auth.service";
import * as locationService from "@/lib/services/location.service";
import * as staffService from "@/lib/services/staff.service";

type Search = Promise<{ error?: string }>;

export default async function TeamPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok || (profile.data.role !== "ADMIN" && profile.data.role !== "MANAGER")) {
    redirect("/dashboard");
  }

  const isManagerOnly = profile.data.role === "MANAGER";

  const staff = await staffService.listStaffByCompany(supabase, profile.data, profile.data.company_id);
  if (!staff.ok) {
    return <p className="text-sm text-red-300">{staff.error}</p>;
  }

  const locations =
    !isManagerOnly && profile.data.company_id
      ? await locationService.listLocations(supabase, profile.data, profile.data.company_id)
      : null;

  return (
    <div className="space-y-8">
      {sp.error ? (
        <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-200">{sp.error}</p>
      ) : null}
      <div>
        <h1 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#E5E2E1] sm:text-3xl">Team</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {isManagerOnly
            ? "Aggiungi barber alla tua sede (password iniziale da comunicare in modo sicuro)."
            : "Crea manager e barber e assegnali a una sede dell’azienda."}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{isManagerOnly ? "Nuovo barber" : "Nuovo membro"}</CardTitle>
            <CardDescription>
              Password iniziale per il membro (comunicagliela in modo sicuro); accesso da /login.
            </CardDescription>
          </CardHeader>
          <form action={inviteTeamMemberAction} className="space-y-3">
            {isManagerOnly ? <input type="hidden" name="role" value="BARBER" /> : null}
            {!isManagerOnly && locations?.ok ? (
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Sede</label>
                <select
                  name="locationId"
                  required
                  className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
                >
                  <option value="">Seleziona sede</option>
                  {locations.data.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {isManagerOnly ? (
              <p className="text-xs text-zinc-500">
                Sede attiva: verrà usata automaticamente quella del tuo profilo.
              </p>
            ) : null}
            {!isManagerOnly && locations && !locations.ok ? (
              <p className="text-xs text-red-300">{locations.error}</p>
            ) : null}
            <input
              name="name"
              required
              placeholder="Nome"
              className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            />
            <input
              name="email"
              type="email"
              required
              placeholder="Email"
              className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
            />
            {!isManagerOnly ? (
              <select
                name="role"
                required
                className="w-full rounded-xl bg-[#353534] px-4 py-3 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2"
              >
                <option value="MANAGER">Manager</option>
                <option value="BARBER">Barber</option>
              </select>
            ) : null}
            <PasswordInput
              name="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Password iniziale (min. 6 caratteri)"
              className="w-full"
            />
            <Button type="submit" className="w-full">
              {isManagerOnly ? "Crea barber" : "Crea membro"}
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Membri attivi</CardTitle>
            <CardDescription>Profili collegati alla tua azienda.</CardDescription>
          </CardHeader>
          <ul className="space-y-3 text-sm text-zinc-200">
            {staff.data.map((m) => {
              const locName = Array.isArray(m.location)
                ? m.location[0]?.name
                : (m.location as { name?: string } | null)?.name;
              return (
                <li key={m.id} className="flex flex-col gap-1 rounded-lg bg-[#2A2A2A]/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span>{m.name}</span>
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-[#E9C349]">
                    <span>{m.role}</span>
                    {locName ? <span className="text-zinc-500">· {locName}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
