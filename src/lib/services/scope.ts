import "server-only";

import type { Profile } from "@/types/domain";
import type { ServiceResult } from "@/types/domain";

export function resolveCompanyScope(
  actor: Profile,
  requestedCompanyId: string | null | undefined,
): ServiceResult<string> {
  if (actor.role === "SUPER_ADMIN") {
    if (!requestedCompanyId) {
      return { ok: false, error: "companyId richiesto" };
    }
    return { ok: true, data: requestedCompanyId };
  }
  if (!actor.company_id) {
    return { ok: false, error: "Azienda non associata" };
  }
  if (requestedCompanyId && requestedCompanyId !== actor.company_id) {
    return { ok: false, error: "Accesso negato: altra azienda" };
  }
  return { ok: true, data: actor.company_id };
}

export function canManageClients(actor: Profile): boolean {
  return actor.role === "ADMIN" || actor.role === "MANAGER" || actor.role === "SUPER_ADMIN";
}

export function canManagePayments(actor: Profile): boolean {
  return actor.role === "ADMIN" || actor.role === "MANAGER" || actor.role === "SUPER_ADMIN";
}

export function canManageCalendar(actor: Profile): boolean {
  return (
    actor.role === "ADMIN" ||
    actor.role === "MANAGER" ||
    actor.role === "BARBER" ||
    actor.role === "SUPER_ADMIN"
  );
}
