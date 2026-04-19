import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseKey, getSupabaseProjectUrl } from "@/lib/supabase/env";

/** Client Supabase con chiave anonima (route handler / chiamate pubbliche senza cookie sessione). */
export function createPublicAnonClient() {
  const url = getSupabaseProjectUrl();
  const key = getPublicSupabaseKey();
  if (!url || !key) {
    throw new Error("Supabase non configurato");
  }
  return createClient(url, key);
}
