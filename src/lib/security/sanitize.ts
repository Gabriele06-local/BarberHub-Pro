const STRIP_PATTERN = /[<>&"'\\]/g;
const HTML_ENTITIES: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
  "'": "&#x27;",
  "\\": "&#x5C;",
};

export function sanitizeText(input: string): string {
  return input.replace(STRIP_PATTERN, (ch) => HTML_ENTITIES[ch] ?? ch);
}

export function sanitizeEmail(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9@.+\-_]/g, "");
}

export function sanitizePhone(input: string): string {
  return input.replace(/[^\d+\s\-()]/g, "").trim();
}

export function sanitizeName(input: string): string {
  return input.replace(/[<>&"'\\]/g, "").trim().slice(0, 120);
}

export function trimObject<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string") {
      (out as Record<string, unknown>)[k] = v.trim();
    }
  }
  return out;
}
