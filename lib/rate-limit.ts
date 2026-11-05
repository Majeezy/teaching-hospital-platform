import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Lazy singleton -- constructed on first use, not at module load, so test
// runs that never call these limiters don't require Upstash env vars to be
// set (same reasoning as the Resend client in lib/email.ts).
let redis: Redis | undefined;
function getRedis(): Redis {
  if (!redis) redis = Redis.fromEnv();
  return redis;
}

let loginIpLimiter: Ratelimit | undefined;
let loginEmailLimiter: Ratelimit | undefined;
let registerIpLimiter: Ratelimit | undefined;

// Two buckets on login: per-IP (catches credential stuffing/spraying from
// one source) and per-email (catches distributed attempts against a single
// account, which a per-IP limit alone wouldn't). Either one tripping blocks
// the attempt.
export function getLoginIpLimiter(): Ratelimit {
  if (!loginIpLimiter) {
    loginIpLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, "5 m"),
      prefix: "ratelimit:login:ip",
    });
  }
  return loginIpLimiter;
}

export function getLoginEmailLimiter(): Ratelimit {
  if (!loginEmailLimiter) {
    loginEmailLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, "5 m"),
      prefix: "ratelimit:login:email",
    });
  }
  return loginEmailLimiter;
}

export function getRegisterIpLimiter(): Ratelimit {
  if (!registerIpLimiter) {
    registerIpLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      prefix: "ratelimit:register:ip",
    });
  }
  return registerIpLimiter;
}

// Loopback addresses, treated the same as a missing header (see
// checkIpLimit below). Confirmed by inspecting the actual Redis keys this
// limiter wrote during a local e2e run: with no real reverse proxy in
// front, Next.js's own request shim fills `x-forwarded-for` from the raw
// socket address -- "::1" locally -- rather than leaving it empty, so a
// missing-header check alone doesn't catch this case.
const NO_SIGNAL_IPS = new Set(["unknown", "::1", "127.0.0.1"]);

// `x-forwarded-for` can be a comma-separated chain (client, proxy1, proxy2)
// or, via the Credentials provider's req.headers, a string[] if the header
// repeated -- the first entry is the original client in both cases.
export function parseClientIp(
  value: string | string[] | undefined | null,
): string {
  if (!value) return "unknown";
  const first = Array.isArray(value) ? value[0] : value;
  return first.split(",")[0].trim() || "unknown";
}

// Shared by every IP-keyed limiter: on Vercel, the platform always sets
// `x-forwarded-for` to the real client address, so a no-signal IP only
// happens with no reverse proxy in front -- local dev, local `next start`
// under Playwright, or a server action called directly from a test. In
// all of those, every caller on the machine would otherwise share one
// bucket, so the check is skipped rather than enforced against a
// meaningless shared key. Real production traffic is never affected by
// this.
export async function checkIpLimit(
  limiter: Ratelimit,
  ip: string,
): Promise<boolean> {
  if (NO_SIGNAL_IPS.has(ip)) return true;
  const { success } = await limiter.limit(ip);
  return success;
}

// For server actions, which don't get a `req` object the way the
// Credentials provider's authorize() does. Falls back to "unknown" (same
// bucket-skipping meaning as in lib/auth.ts) both when there's no
// forwarded-IP header and when there's no request scope at all --
// `headers()` throws when called outside a real HTTP request, which is
// exactly what happens when a test calls a server action directly rather
// than through the app.
export async function getServerActionClientIp(): Promise<string> {
  try {
    const headerList = await headers();
    return parseClientIp(headerList.get("x-forwarded-for"));
  } catch {
    return "unknown";
  }
}
