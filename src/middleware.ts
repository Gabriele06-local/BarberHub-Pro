import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { applySecurityHeaders } from "@/lib/security/headers";
import { checkRateLimit, extractClientIp, getRateLimitHeaders } from "@/lib/security/rate-limit";
import { getOrCreateTraceId, setTraceHeader } from "@/lib/telemetry";
import { setLoggerTraceId } from "@/lib/logger";
import { enforceSession } from "@/lib/security/auth-hardening";

const PUBLIC_PATHS = ["/login", "/setup", "/book", "/api/public", "/auth/callback"];

export async function middleware(request: NextRequest) {
  const start = Date.now();
  const { traceId } = getOrCreateTraceId(request.headers);
  setLoggerTraceId(traceId);

  // Rate limiting
  const clientIp = extractClientIp(request.headers);
  const { allowed, remaining } = await checkRateLimit(`mw:${clientIp}`);

  if (!allowed) {
    const response = new NextResponse(JSON.stringify({ error: "Too Many Requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "60",
        ...getRateLimitHeaders(100, 0),
      },
    });
    setTraceHeader(response.headers, traceId);
    return response;
  }

  // CSRF check for state-changing requests
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const path = request.nextUrl.pathname;
    const isPublicApi = PUBLIC_PATHS.some((p) => path.startsWith(p));
    if (!isPublicApi) {
      const cookieToken = request.cookies.get("__Host-csrf-token")?.value;
      const headerToken = request.headers.get("x-csrf-token");
      if (cookieToken && headerToken) {
        const { validateCsrfToken } = await import("@/lib/security/csrf");
        if (!validateCsrfToken(cookieToken, headerToken)) {
          const response = new NextResponse(JSON.stringify({ error: "CSRF validation failed" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
          setTraceHeader(response.headers, traceId);
          return response;
        }
      }
    }
  }

  // Session check (Supabase + auth hardening)
  const sessionRedirect = await enforceSession(request);

  // Session refresh (existing Supabase middleware)
  const response = sessionRedirect ?? (await updateSession(request));

  // Security headers
  applySecurityHeaders(response);

  // Rate limit + telemetry headers
  Object.entries(getRateLimitHeaders(100, remaining)).forEach(([k, v]) => {
    response.headers.set(k, v);
  });
  setTraceHeader(response.headers, traceId);
  response.headers.set("X-Response-Time-MS", String(Date.now() - start));

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
