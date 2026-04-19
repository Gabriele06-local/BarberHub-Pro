/**
 * Chiave pubblica Supabase: accetta il nome legacy (anon) o quello nuovo (publishable).
 * @see https://supabase.com/docs/guides/api/api-keys
 */
export function getPublicSupabaseKey(): string | undefined {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return anon || publishable || undefined;
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = getPublicSupabaseKey();
  return Boolean(url && key);
}

/** URL progetto (stesso valore usato dal client). */
export function getSupabaseProjectUrl(): string | undefined {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return u || undefined;
}

/** Chiave service role: solo server, mai esposta al browser. */
export function getServiceRoleKey(): string | undefined {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return k || undefined;
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(getSupabaseProjectUrl() && getServiceRoleKey());
}

/**
 * Origine pubblica dell’app (inviti Auth, reset password, callback).
 * In locale senza env usa http://localhost:3000.
 */
export function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) {
    return explicit;
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/^https?:\/\//, "")}`;
  }
  return "http://localhost:3000";
}

/** URL assoluto del route handler che scambia il `code` dell’email (invito / magic link / recovery). */
export function getAuthCallbackUrl(): string {
  return `${getAppBaseUrl()}/auth/callback`;
}
