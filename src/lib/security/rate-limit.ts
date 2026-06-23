import { getRateLimitConfig } from "@/lib/env";

const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

let redisClient: {
  incr: (key: string) => Promise<number>;
  pexpire: (key: string, ms: number) => Promise<unknown>;
  expire?: (key: string, sec: number) => Promise<unknown>;
} | null = null;

let redisAvailable = false;

async function initRedis() {
  if (redisClient !== null) return;
  try {
    const { Redis } = await import("@upstash/redis");
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) {
      const r = new Redis({ url, token });
      redisClient = r;
      redisAvailable = true;
    }
  } catch {
    redisAvailable = false;
  }
}

export function extractClientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    if (ips.length > 0) return ips[0];
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function checkRateLimit(key: string): Promise<{ allowed: boolean; remaining: number }> {
  const { max, windowMs } = getRateLimitConfig();

  if (!redisAvailable) {
    await initRedis();
  }

  if (redisAvailable && redisClient) {
    try {
      const redisKey = `ratelimit:${key}`;
      const count = await redisClient.incr(redisKey);
      if (count === 1) {
        await redisClient.pexpire(redisKey, windowMs);
      }
      const allowed = count <= max;
      return { allowed, remaining: Math.max(0, max - count) };
    } catch {
      redisAvailable = false;
    }
  }

  const now = Date.now();
  const entry = inMemoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }

  entry.count += 1;
  if (entry.count > max) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: max - entry.count };
}

export function getRateLimitHeaders(max: number, remaining: number): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(max),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + 60),
  };
}
