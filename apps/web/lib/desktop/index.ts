// Window adapter shared by the browser build and the Tauri desktop shell.
//
// In the desktop app, Tauri owns every native window: the page asks it to open a Case Terminal or
// pop out a panel, and Tauri creates, places and tracks that window itself (see
// src-tauri/src/lib.rs). In a plain browser the same calls fall back to ordinary web behavior.
// Components call these helpers and never need to know which one ran.
//
// Talks to Tauri through the `window.__TAURI__` global (the shell sets `withGlobalTauri`) rather
// than the @tauri-apps/api package, so the web app carries no desktop-only dependency.

type Unlisten = () => void

interface TauriGlobal {
  core: {
    invoke: <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>
  }
  event: {
    listen: <T>(event: string, handler: (event: { payload: T }) => void) => Promise<Unlisten>
  }
}

declare global {
  interface Window {
    __TAURI__?: TauriGlobal
  }
}

/** Payload of the shell's `panel-window-closed` event, and of browser popup closes alike. */
export interface PanelWindowClosed {
  caseId: string
  panelId: string
}

function tauri(): TauriGlobal | undefined {
  return typeof window === "undefined" ? undefined : window.__TAURI__
}

export function isDesktop(): boolean {
  return tauri() !== undefined
}

/**
 * Opens (or focuses) this case's Terminal in its own native window, on another monitor when
 * there is one. Returns false outside the desktop app — the caller should navigate normally
 * (a Link or router.push keeps same-tab navigation and middle-click working in the browser).
 */
export function openCaseTerminal(caseId: string): boolean {
  const t = tauri()
  if (!t) return false
  t.core.invoke("open_case_terminal", { caseId }).catch((err) => {
    console.error("open_case_terminal failed", err)
  })
  return true
}

// Browser popups this tab opened, keyed by `${caseId}:${panelId}`. A browser gives the opener no
// close event for a popup, so `win.closed` is polled while any are open — the only reliable signal
// that needs no cooperation from the popped-out page itself.
const browserPopups = new Map<string, { win: Window; closed: PanelWindowClosed }>()
const browserClosedHandlers = new Set<(closed: PanelWindowClosed) => void>()
let browserPollTimer: ReturnType<typeof setInterval> | null = null

function pollBrowserPopups() {
  for (const [key, popup] of browserPopups) {
    if (!popup.win.closed) continue
    browserPopups.delete(key)
    for (const handler of browserClosedHandlers) handler(popup.closed)
  }
  if (browserPopups.size === 0 && browserPollTimer) {
    clearInterval(browserPollTimer)
    browserPollTimer = null
  }
}

/**
 * Pops a Terminal panel out into its own window. On desktop it's a native window owned by the
 * current one (it closes when this window does); in a browser it's a popup. Returns false only
 * when nothing opened (a blocked popup), so the caller can leave the pane where it is.
 */
export function openPanelWindow(caseId: string, panelId: string): boolean {
  const t = tauri()
  if (t) {
    t.core.invoke("open_panel_window", { caseId, panelId }).catch((err) => {
      console.error("open_panel_window failed", err)
    })
    return true
  }

  const win = window.open(
    `/homepage/terminal/${caseId}/panel/${panelId}`,
    `terminal-panel-${caseId}-${panelId}`,
    "width=560,height=680",
  )
  if (!win) return false
  browserPopups.set(`${caseId}:${panelId}`, { win, closed: { caseId, panelId } })
  browserPollTimer ??= setInterval(pollBrowserPopups, 500)
  return true
}

/**
 * Calls `handler` whenever a popped-out panel window closes — a desktop-shell window anywhere in
 * the app, or a browser popup this tab opened. Returns an unsubscribe function.
 */
export function onPanelWindowClosed(handler: (closed: PanelWindowClosed) => void): Unlisten {
  const t = tauri()
  if (!t) {
    browserClosedHandlers.add(handler)
    return () => {
      browserClosedHandlers.delete(handler)
    }
  }

  let unlisten: Unlisten | null = null
  let disposed = false
  t.event
    .listen<PanelWindowClosed>("panel-window-closed", (event) => handler(event.payload))
    .then((fn) => {
      if (disposed) fn()
      else unlisten = fn
    })
  return () => {
    disposed = true
    unlisten?.()
  }
}
