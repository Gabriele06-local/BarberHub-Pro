import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseKey, getSupabaseProjectUrl } from "@/lib/supabase/env";

const SENSITIVE_PATHS = ["/dashboard", "/api/private"];

export async function enforceSession(request: NextRequest): Promise<NextResponse | null> {
  const url = getSupabaseProjectUrl();
  const key = getPublicSupabaseKey();
  if (!url || !key) return null;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () =>
        request.cookies.getAll().map((c) => ({
          name: c.name,
          value: c.value,
        })),
      setAll: () => {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && SENSITIVE_PATHS.some((p) => path.startsWith(p))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (path === "/login" || path === "/setup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return null;
}
