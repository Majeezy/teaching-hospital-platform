// Date.prototype.toLocaleString()/toLocaleDateString() with no explicit
// locale/timeZone use the JS runtime's own default -- fine for a purely
// client-rendered app, but these components render on the server first
// (SSR) and then hydrate on the client. Vercel's server runtime and a
// visitor's browser very often disagree on default locale/timezone,
// so the server-rendered string and the client's first render of the
// same expression can differ, which React treats as a hydration
// mismatch (error #418) -- confirmed live on /appointments during the
// Phase 4 Stage 5 production smoke test. Pinning both explicitly here
// makes the output identical regardless of where it renders.
export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-US", { timeZone: "UTC" });
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", { timeZone: "UTC" });
}
