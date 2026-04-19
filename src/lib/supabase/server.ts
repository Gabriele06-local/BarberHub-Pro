import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseKey, isSupabaseConfigured } from "@/lib/supabase/env";

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = getPublicSupabaseKey();
  if (!isSupabaseConfigured() || !url || !key) {
    throw new Error(
      "Mancano NEXT_PUBLIC_SUPABASE_URL e una chiave pubblica: " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY oppure NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Riavvia npm run dev dopo aver salvato .env.local. Istruzioni: /setup",
    );
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* Server Component: i cookie verranno applicati dal middleware */
        }
      },
    },
  });
}
