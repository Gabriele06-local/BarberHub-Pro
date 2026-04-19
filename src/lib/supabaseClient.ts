"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseKey } from "@/lib/supabase/env";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = getPublicSupabaseKey();
  if (!url || !key) {
    throw new Error(
      "Mancano NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Vedi /setup.",
    );
  }
  return createBrowserClient(url, key);
}
