import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required").optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url("NEXT_PUBLIC_SITE_URL must be a valid URL").optional(),

  SENTRY_DSN: z.string().url("SENTRY_DSN must be a valid URL").optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]).optional().default("info"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().optional().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().optional().default(60_000),
});

type Env = z.infer<typeof envSchema>;

let _parsed: Env | null = null;

function parse(): Env {
  if (!_parsed) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(`Environment validation failed:\n${issues}\n\nCheck .env.example for required variables.`);
    }
    _parsed = result.data;
  }
  return _parsed;
}

export function env(): Env {
  return parse();
}

export function isSentryConfigured(): boolean {
  try {
    return Boolean(env().SENTRY_DSN);
  } catch {
    return false;
  }
}

export function getRateLimitConfig() {
  const e = env();
  return {
    max: e.RATE_LIMIT_MAX,
    windowMs: e.RATE_LIMIT_WINDOW_MS,
  };
}

export { envSchema };
