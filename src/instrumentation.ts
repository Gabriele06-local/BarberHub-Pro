import { isSentryConfigured } from "@/lib/env";

export async function register() {
  if (isSentryConfigured()) {
    const { init } = await import("@sentry/nextjs");
    init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
      enabled: process.env.NODE_ENV === "production",
      integrations: [],
    });
  }
}
