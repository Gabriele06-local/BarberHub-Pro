const TRACE_HEADER = "x-trace-id";

function generateTraceId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export function getOrCreateTraceId(headers?: Headers): { traceId: string; isNew: boolean } {
  const existing = headers?.get(TRACE_HEADER);
  if (existing && /^[a-f0-9]{16}$/i.test(existing)) {
    return { traceId: existing, isNew: false };
  }
  return { traceId: generateTraceId(), isNew: true };
}

export function setTraceHeader(headers: Headers, traceId: string): void {
  headers.set(TRACE_HEADER, traceId);
}

export { TRACE_HEADER };
