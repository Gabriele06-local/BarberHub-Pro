import type { NextResponse } from "next/server";

const CSP = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.supabase.co`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://*.supabase.co`,
  `font-src 'self' data:`,
  `connect-src 'self' https://*.supabase.co https://*.sentry.io ws://localhost:*`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
].join("; ");

const HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-DNS-Prefetch-Control": "on",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Content-Security-Policy": CSP,
};

export function applySecurityHeaders(response: NextResponse): void {
  for (const [key, value] of Object.entries(HEADERS)) {
    response.headers.set(key, value);
  }
}
