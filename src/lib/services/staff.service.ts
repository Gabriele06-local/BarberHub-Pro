import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, ServiceResult, UserRole } from "@/types/domain";
import { resolveCompanyScope } from "@/lib/services/scope";

export type StaffRow = Pick<Profile, "id" | "name" | "role" | "location_id"> & {
  location?: { name: string } | null;
};

export async function listStaffByCompany(
  supabase: SupabaseClient,
  actor: Profile,
  companyId?: string | null,
  roles?: UserRole[],
  opts?: { barbersAtActorLocation?: boolean },
): Promise<ServiceResult<StaffRow[]>> {
  const scope = resolveCompanyScope(actor, companyId);
  if (!scope.ok) {
    return scope;
  }

  let query = supabase
    .from("profiles")
    .select("id,name,role,location_id,location:locations(name)")
    .eq("company_id", scope.data)
    .order("role", { ascending: true });

  if (roles?.length) {
    query = query.in("role", roles);
  }

  if (
    opts?.barbersAtActorLocation &&
    actor.role === "MANAGER" &&
    actor.location_id &&
    roles?.length === 1 &&
    roles[0] === "BARBER"
  ) {
    query = query.eq("location_id", actor.location_id);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }
  const rows = (data ?? []).map((row) => {
    const loc = row.location as { name: string } | { name: string }[] | null | undefined;
    const location = Array.isArray(loc) ? (loc[0] ?? null) : loc ?? null;
    return { ...row, location } as StaffRow;
  });
  return { ok: true, data: rows };
}
