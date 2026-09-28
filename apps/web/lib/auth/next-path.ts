/**
 * Where to send someone after signing in (`?next=` on /login, `next` on /handoff) — only ever a
 * path on this same site. The value comes from a link, so it's attacker-controllable: a full URL,
 * `//evil.example`, `/\evil.example` (browsers read /\ as //) or `/<tab>/evil.example` (browsers
 * drop tabs/newlines) would all turn a sign-in into an open redirect.
 *
 * Rather than list tricks, resolve it the way the browser will, against a placeholder site, and
 * keep it only if it stayed there.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/homepage"): string {
  if (!raw || !raw.startsWith("/")) return fallback
  const placeholder = "http://next-path.invalid"
  let resolved: URL
  try {
    resolved = new URL(raw, placeholder)
  } catch {
    return fallback
  }
  if (resolved.origin !== placeholder) return fallback
  return `${resolved.pathname}${resolved.search}${resolved.hash}`
}
