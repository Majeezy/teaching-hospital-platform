import type { NextConfig } from "next";

// This app has no third-party scripts or iframes anywhere -- every
// directive below is "self" or stricter except connect-src, which also
// allows vercel.com: client-side document uploads (@vercel/blob/client's
// upload(), Phase 6 Stage 2) PUT the file straight from the browser to
// Vercel Blob's control-plane API, bypassing our own server entirely --
// that's the whole point (no Server Action body-size limit). unsafe-inline
// stays on script-src/style-src because Next.js's own hydration payload
// and Tailwind's injected styles both rely on inline tags; a nonce-based
// CSP would need per-request middleware wiring that isn't worth it given
// there's still no external *script* source.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://vercel.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
