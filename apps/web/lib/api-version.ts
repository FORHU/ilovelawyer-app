// Shared by lib/fetch.ts (runtime requests) and next.config.ts (rewrites(), which runs at
// config-load time and can't import lib/fetch.ts — that file pulls in the zustand auth store).
// Kept dependency-free so both can import it directly instead of hand-syncing two copies.

export const AUTH_PATHS = [
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/auth/login",
  "/api/auth/google",
  "/api/auth/reset-password",
  "/api/auth/verify-otp",
] as const

// Defaults to "" (no-op — paths hit the backend exactly as written, today's behavior) until
// NEXT_PUBLIC_API_VERSION_PREFIX is set: the backend doesn't serve /api/v1 yet (see ADR 0011's
// rollout note on ilovelawyer-api's presign endpoint for why shipping a frontend-only path
// change ahead of backend support breaks every request). Set it to "/api/v1" only once that's
// confirmed live.
// Read inside the function (not hoisted to a module-scope const) so this reflects
// process.env at call time rather than whatever it was when the module first loaded.
export function versioned(path: string): string {
  const prefix = process.env.NEXT_PUBLIC_API_VERSION_PREFIX ?? ""
  if (!prefix || !path.startsWith("/api/")) return path
  return `${prefix}${path.slice("/api".length)}`
}
