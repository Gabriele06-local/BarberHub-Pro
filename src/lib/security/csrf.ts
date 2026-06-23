import { randomBytes, timingSafeEqual } from "node:crypto";

const CSRF_COOKIE = "__Host-csrf-token";
const CSRF_HEADER = "x-csrf-token";
const TOKEN_LENGTH = 32;

export function generateCsrfToken(): string {
  return randomBytes(TOKEN_LENGTH).toString("hex");
}

export function validateCsrfToken(cookieToken: string | undefined, headerToken: string | undefined): boolean {
  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length !== TOKEN_LENGTH * 2) return false;
  if (headerToken.length !== TOKEN_LENGTH * 2) return false;

  try {
    const a = Buffer.from(cookieToken, "hex");
    const b = Buffer.from(headerToken, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export { CSRF_COOKIE, CSRF_HEADER };
