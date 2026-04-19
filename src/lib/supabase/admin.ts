import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ServiceResult } from "@/types/domain";
import { getServiceRoleKey, getSupabaseProjectUrl } from "@/lib/supabase/env";

const ADMIN_CONFIG_HINT =
  "Aggiungi SUPABASE_SERVICE_ROLE_KEY in .env.local (Dashboard Supabase → Settings → API → service_role). Serve solo lato server per inviti Auth; riavvia npm run dev. Dettagli: /setup.";

/**
 * Client Supabase con privilegi admin. Restituisce errore leggibile se mancano env (niente throw).
 */
export function tryCreateAdminClient(): ServiceResult<SupabaseClient> {
  const url = getSupabaseProjectUrl();
  const key = getServiceRoleKey();
  if (!url || !key) {
    return {
      ok: false,
      error: !url
        ? `Manca NEXT_PUBLIC_SUPABASE_URL. ${ADMIN_CONFIG_HINT}`
        : `Manca SUPABASE_SERVICE_ROLE_KEY. ${ADMIN_CONFIG_HINT}`,
    };
  }
  return {
    ok: true,
    data: createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}
