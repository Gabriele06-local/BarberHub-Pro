import { format } from "date-fns";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarAvailabilityPanel } from "@/components/calendar/CalendarAvailabilityPanel";
import * as authService from "@/lib/services/auth.service";
import * as clientService from "@/lib/services/client.service";
import * as locationService from "@/lib/services/location.service";
import * as staffService from "@/lib/services/staff.service";

type Search = Promise<{ date?: string; error?: string }>;

export default async function CalendarPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    redirect("/login");
  }
  if (
    profile.data.role !== "ADMIN" &&
    profile.data.role !== "MANAGER" &&
    profile.data.role !== "BARBER"
  ) {
    redirect("/dashboard");
  }
  if (!profile.data.company_id) {
    redirect("/dashboard");
  }

  const day = sp.date ?? format(new Date(), "yyyy-MM-dd");

  const canCreate = profile.data.role === "ADMIN" || profile.data.role === "MANAGER";

  const clients = canCreate
    ? await clientService.listClients(supabase, profile.data, profile.data.company_id)
    : null;
  const barbers = canCreate
    ? await staffService.listStaffByCompany(
        supabase,
        profile.data,
        profile.data.company_id,
        ["BARBER"],
        { barbersAtActorLocation: profile.data.role === "MANAGER" },
      )
    : null;

  const locationsPanel =
    canCreate && profile.data.company_id
      ? await locationService.listLocations(supabase, profile.data, profile.data.company_id)
      : null;

  const defaultLocId =
    profile.data.role === "MANAGER" && profile.data.location_id
      ? profile.data.location_id
      : locationsPanel?.ok && locationsPanel.data[0]
        ? locationsPanel.data[0].id
        : "";

  return (
    <div className="space-y-8">
      {sp.error ? (
        <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-200">{sp.error}</p>
      ) : null}
      <div>
        <h1 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[#E5E2E1] sm:text-3xl">
          Calendario
        </h1>
      </div>

      {!canCreate ? (
        <p className="text-sm text-zinc-500">
          Gli slot pubblici e la pianificazione sono gestiti da admin o manager di sede.
        </p>
      ) : null}

      {canCreate && locationsPanel?.ok && defaultLocId && barbers?.ok && clients?.ok ? (
        <CalendarAvailabilityPanel
          companyId={profile.data.company_id}
          locations={locationsPanel.data.map((l) => ({ id: l.id, name: l.name }))}
          defaultLocationId={defaultLocId}
          barbers={barbers.data.map((b) => ({ id: b.id, name: b.name }))}
          clients={clients.data.map((c) => ({ id: c.id, name: c.name }))}
          weekAnchorDay={day}
        />
      ) : null}
    </div>
  );
}
