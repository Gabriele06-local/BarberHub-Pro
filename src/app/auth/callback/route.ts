import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseKey, getSupabaseProjectUrl, isSupabaseConfigured } from "@/lib/supabase/env";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  const projectUrl = getSupabaseProjectUrl()!;
  const anonKey = getPublicSupabaseKey()!;

  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");

  const loginWithError = (message: string) =>
    NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.url),
    );

  if (!code) {
    return loginWithError("Link non valido o scaduto. Richiedi un nuovo invito o reimposta la password.");
  }

  const successRedirect = NextResponse.redirect(new URL(nextPath, request.url));

  const supabase = createServerClient(projectUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          successRedirect.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return loginWithError(error.message);
  }

  return successRedirect;
}
