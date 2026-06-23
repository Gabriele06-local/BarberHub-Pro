import { TRACE_HEADER } from "@/lib/telemetry";

type LogLevel = "fatal" | "error" | "warn" | "info" | "debug";

const isProduction = process.env.NODE_ENV === "production";

const LEVELS: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? (isProduction ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] <= LEVELS[currentLevel];
}

function formatValue(v: unknown): string {
  if (typeof v === "object" && v !== null) {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function log(level: LogLevel, msg: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const traceId =
    typeof globalThis !== "undefined"
      ? ((globalThis as Record<string, unknown>)[`__trace_${TRACE_HEADER}`] as string | undefined)
      : undefined;

  const time = new Date().toISOString();
  const parts = [`[${time}]`, `[${level.toUpperCase()}]`];

  if (traceId) parts.push(`[trace=${traceId}]`);
  parts.push(msg);

  if (meta && Object.keys(meta).length > 0) {
    parts.push(
      Object.entries(meta)
        .map(([k, v]) => `${k}=${formatValue(v)}`)
        .join(" "),
    );
  }

  const output = parts.join(" ");

  if (level === "fatal" || level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export function setLoggerTraceId(traceId: string): void {
  (globalThis as Record<string, unknown>)[`__trace_${TRACE_HEADER}`] = traceId;
}

export const logger = {
  fatal: (msg: string, meta?: Record<string, unknown>) => log("fatal", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
};
