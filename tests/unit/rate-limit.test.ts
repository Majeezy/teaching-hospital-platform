import { describe, expect, it, vi } from "vitest";
import type { Ratelimit } from "@upstash/ratelimit";
import {
  checkIpLimit,
  getServerActionClientIp,
  parseClientIp,
} from "@/lib/rate-limit";

function makeLimiter(success: boolean) {
  return { limit: vi.fn().mockResolvedValue({ success }) } as unknown as Ratelimit;
}

describe("parseClientIp", () => {
  it("takes the first entry of a forwarding chain", () => {
    expect(parseClientIp("203.0.113.1, 10.0.0.1, 10.0.0.2")).toBe(
      "203.0.113.1",
    );
  });

  it("takes the first entry when the header repeated as an array", () => {
    expect(parseClientIp(["203.0.113.1", "198.51.100.2"])).toBe(
      "203.0.113.1",
    );
  });

  it("falls back to 'unknown' for a missing header", () => {
    expect(parseClientIp(undefined)).toBe("unknown");
    expect(parseClientIp(null)).toBe("unknown");
  });

  it("falls back to 'unknown' for an empty header", () => {
    expect(parseClientIp("")).toBe("unknown");
  });
});

describe("checkIpLimit", () => {
  it("skips the limiter entirely for an 'unknown' IP", async () => {
    const limiter = makeLimiter(false);
    const ok = await checkIpLimit(limiter, "unknown");
    expect(ok).toBe(true);
    expect(limiter.limit).not.toHaveBeenCalled();
  });

  it("skips the limiter for loopback addresses (no reverse proxy in front)", async () => {
    const limiter = makeLimiter(false);
    expect(await checkIpLimit(limiter, "::1")).toBe(true);
    expect(await checkIpLimit(limiter, "127.0.0.1")).toBe(true);
    expect(limiter.limit).not.toHaveBeenCalled();
  });

  it("defers to the limiter's own result for a real IP", async () => {
    const allowed = makeLimiter(true);
    expect(await checkIpLimit(allowed, "203.0.113.1")).toBe(true);

    const blocked = makeLimiter(false);
    expect(await checkIpLimit(blocked, "203.0.113.1")).toBe(false);
    expect(blocked.limit).toHaveBeenCalledWith("203.0.113.1");
  });
});

describe("getServerActionClientIp", () => {
  it("falls back to 'unknown' when called outside a request scope", async () => {
    // Vitest's plain Node environment has no Next.js request context, so
    // next/headers' headers() throws here -- exactly the case a test
    // calling a server action directly (not through a real HTTP request)
    // hits in actions/auth.ts.
    await expect(getServerActionClientIp()).resolves.toBe("unknown");
  });
});
