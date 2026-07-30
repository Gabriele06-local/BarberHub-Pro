import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { navigationForRole } from "@/lib/navigation";
import * as authService from "@/lib/services/auth.service";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }
  const supabase = await createClient();
  const profile = await authService.getCurrentProfile(supabase);
  if (!profile.ok) {
    /* Evita loop login ↔ dashboard se Auth esiste ma manca la riga in public.profiles */
    redirect("/login");
  }

  const items = navigationForRole(profile.data.role);

  let scopeSubtitle: string | null = null;
  if (profile.data.role === "ADMIN" && profile.data.company_id) {
    const { data } = await supabase
      .from("companies")
      .select("name")
      .eq("id", profile.data.company_id)
      .maybeSingle();
    scopeSubtitle = data?.name ? String(data.name) : null;
  } else if (
    (profile.data.role === "MANAGER" || profile.data.role === "BARBER") &&
    profile.data.location_id
  ) {
    const { data } = await supabase
      .from("locations")
      .select("name")
      .eq("id", profile.data.location_id)
      .maybeSingle();
    scopeSubtitle = data?.name ? String(data.name) : null;
  }

  return (
    <DashboardShell
      userName={profile.data.name}
      role={profile.data.role}
      items={items}
      scopeSubtitle={scopeSubtitle}
    >
      {children}
    </DashboardShell>
  );
}
