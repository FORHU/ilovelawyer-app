// Login handoff between the desktop app and a browser on the same PC.
//
// The two are separate clients — the desktop app's built-in browser keeps its own cookies, and
// neither can read the other's login. So the one that's signed in asks the API for a one-time
// code (valid ~60s, single use) and passes it to the other, which trades it for a login of its
// own on the /handoff page. Neither client is ever signed out by it. API side:
// ilovelawyer-api/src/utils/handoff.ts.
//
//   desktop → browser   openInBrowser()     code rides in a normal link; the desktop app's popup
//                                            rule sends it to the default browser (popups.rs)
//   browser → desktop   openInDesktopApp()  code rides in an ilovelawyer:// link, which Windows
//                                            hands to the desktop app (src-tauri deep link)

import { apiFetch } from "@/lib/fetch"
import { isDesktop } from "@/lib/desktop"
import { safeNextPath } from "@/lib/auth/next-path"

/** The link scheme the desktop app registers with Windows. Keep in sync with src-tauri. */
export const DESKTOP_LINK_SCHEME = "ilovelawyer"

async function requestHandoffCode(): Promise<string> {
  const { code } = await apiFetch<{ code: string; expiresInSeconds: number }>("/api/auth/handoff", { method: "POST" })
  return code
}

/** Where to go after the handoff — same-site paths only (lib/auth/next-path.ts). */
export { safeNextPath }

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`
}

/** Desktop app only: opens `path` (default: this page) in the user's normal browser, signed in. */
export async function openInBrowser(path: string = currentPath()): Promise<void> {
  const code = await requestHandoffCode()
  const url = `${window.location.origin}/handoff?code=${encodeURIComponent(code)}&next=${encodeURIComponent(safeNextPath(path))}`
  // A new window from the desktop app goes to the default browser — see src-tauri's popups.rs.
  window.open(url, "_blank", "noopener,noreferrer")
}

/**
 * Browser only: opens `path` (default: this page) in the desktop app, signed in. If the app
 * isn't installed nothing happens beyond the browser's own "open this link?" prompt — callers
 * should say so rather than promise it worked.
 */
export async function openInDesktopApp(path: string = currentPath()): Promise<void> {
  const code = await requestHandoffCode()
  const params = new URLSearchParams({ code, site: window.location.origin, next: safeNextPath(path) })
  window.location.href = `${DESKTOP_LINK_SCHEME}://handoff?${params.toString()}`
}

/** Which of the two the account menu should offer here. */
export function handoffTarget(): "browser" | "desktop" {
  return isDesktop() ? "browser" : "desktop"
}
