# Plan: Tauri owns the Case Terminal windows

**Status (2026-09-24):** implemented and committed, not yet validated. The Rust side has never been compiled (no Rust toolchain on the machine it was written on) and nothing has run under `tauri dev`. The web-app side passes `tsc --noEmit` and all 127 vitest tests.

| Repo | Branch | Commit |
|---|---|---|
| `ilovelawyer-desktop` | `feature/tauri-window-ownership` | `c27e919` |
| `ilovelawyer-app` | `feature/tauri-desktop-shell` | `d7786aa` |

See [`architecture.md`](architecture.md) for how the resulting window model works. This doc records **why** it's built this way and **what's left** before it can be trusted.

## The rule

**Next.js decides what the user wants to open. Tauri decides how that becomes a native window.**

- `ilovelawyer-app` owns the application: dashboard, cases, panels, routing, auth, API calls.
- `ilovelawyer-desktop` owns the desktop: creating, placing, focusing and closing windows across monitors. It never touches case data, auth or the API.
- `ilovelawyer-api` stays the backend authority. Unchanged by this work.

**Tauri is the window owner, not a window detector.** Earlier, the pop-out used `window.open` and the idea was for Tauri to find that window afterwards and move it. That's fragile: it means picking one browser window out of many. Now every native window exists because Tauri created it, on an explicit request, under a label it chose.

## How a window gets opened

```
User clicks "Open Terminal"
        │
        ▼
Next.js  →  lib/desktop  (the only place the web app knows Tauri exists)
        │
        ├── Browser?  →  normal Link / window.open  (unchanged web behavior)
        │
        └── Desktop?  →  invoke("open_case_terminal", { caseId })
                              │
                              ▼
                         Rust validates the id, builds the route,
                         picks a monitor, creates or focuses
                         case-terminal-{id}
                              │
                              ▼
                         /homepage/terminal/{id}  (the existing Next.js page)
```

Panels work the same way through `open_panel_window({ caseId, panelId })` → `panel-{case}-{panel}` → `/homepage/terminal/{case}/panel/{panel}`.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Repo structure | Keep three separate repos | The API / app / desktop split matches the authority split above. Merging into a monorepo would couple web and desktop releases for no gain. |
| What opens at launch | One `main` dashboard window on the primary monitor; Case Terminals open on demand on another monitor | Matches the intended flow: dashboard on monitor 1, the case you open on monitor 2. Replaces "one Terminal per monitor". |
| How the web app calls Tauri | `window.__TAURI__` global (`withGlobalTauri`) behind a small typed adapter, `apps/web/lib/desktop/index.ts` | No desktop-only npm dependency in the web app; the browser build is untouched. |
| Closing `main` | Exits the whole app (closes every window, stops the sidecar) | `main` *is* the app; otherwise there's no way back to the dashboard. |
| Opening another case from a Terminal | A separate `case-terminal-{id}` window per case; reopening focuses the existing one | Lets two cases sit on two monitors side by side, and keeps the label matching the case shown. |
| Which origins may call Tauri | `http://localhost:*` and `https://*.ilovelawyer.com` | Covers dev, the bundled sidecar and every tenant subdomain. Narrow to exact hostnames before shipping (see below). |
| Command shape | Specific commands (`open_case_terminal`, `open_panel_window`), **not** a generic `open_window(url, x, y)` | The UI can load from a remote site. A generic command would let any script on that page (including an injected one) open any website in a native, app-branded window, which is a phishing surface. Specific commands mean the worst case is opening a real case route. If more flexibility is needed later, use `open_window({ kind, id, placement })` with a fixed list of kinds, never a raw URL. |
| Adapter layout | One file (~130 lines), not split into `runtime.ts` / `windows.ts` | Splitting now is cosmetic. Split when a third desktop concern (notifications, shortcuts) appears. |
| Where panel fallback lives | In the adapter, not the component | `LegalTerminal` calls `openPanelWindow` and `onPanelWindowClosed` without knowing which environment it's in. In a browser the adapter opens a popup and polls `win.closed`; on desktop it uses the shell's `panel-window-closed` event. |
| Terminal links in a browser | Stay `<Link>`s; the click handler only cancels navigation on desktop | Keeps same-tab navigation and middle-click working in the browser, which a `window.open` fallback would lose. |
| Remote vs. bundled frontend | Keep both. Use remote (`FRONTEND_URL`) heavily for dev and staging; pick the production default after a bundled build has actually been tested | Remote means UI changes ship with a web deploy and the desktop UI never drifts from the API. Bundled is the more conventional desktop app. Both already work in code; only remote has been exercised. |

### Options considered and set aside

- **Monorepo (Next.js + `src-tauri` together):** couples releases and pulls Tauri into the web repo. Not needed while the desktop app has no UI of its own.
- **Shared packages + separate desktop app:** only worth it if the desktop UI diverges, needs offline access, or has to keep client files on the device. `ilovelawyer-app` is already a pnpm workspace with `packages/ui`, so this path stays open.
- **Browser extension managing Chrome/Edge windows:** only needed if the Case Terminal must remain a browser tab. It doesn't.
- **Pure `window.open`:** fine for the browser build, but can't place windows on a chosen monitor, which was the point.

## Validation checklist (next milestone)

No more architecture changes until this passes.

1. **Web app:** `pnpm typecheck` ✅ (clean), `vitest run` ✅ (127/127).
2. **Rust:** install Rust + MSVC build tools (README steps 1–2), then `cargo check` in `src-tauri`. ⬜ Never compiled.
3. **API:** `npm ci` in `ilovelawyer-api` (first attempt failed on a dropped Prisma engine download, `ECONNRESET`; retry, with `NODE_OPTIONS=--use-system-ca` if needed), then `npx tsc --noEmit` and `npm test`. ⬜
4. **`tauri dev`:** ⬜
   - Only `main` opens, maximized on the primary monitor.
   - Opening a case from each entry point (case portfolio list, case detail tab bar, case detail overview, Terminal case picker, create-case with "open in Terminal") opens it on the other monitor; opening it again focuses the same window.
   - Single-monitor setup: the Terminal opens on the same monitor, nothing breaks.
   - Logged in on `main` means logged in on the Terminal (Test 3B).
   - Pop out one panel, then several: they appear near the right edge, cascading. Closing one puts its pane back on the grid.
   - Closing a Terminal closes its panels (Test 3C).
   - Closing `main` exits the app.
   - `window.__TAURI__` exists in devtools, and the `remote.urls` patterns actually allow the commands (the exact pattern syntax is unverified).
   - `invoke("open_case_terminal", { caseId: "../x" })` from devtools is rejected.
5. **Browser build:** every link and panel pop-out behaves exactly as before. ⬜
6. **`tauri build`** at least once, then test the bundled frontend (see `production-readiness.md` blockers #3 and #4). ⬜

## Before shipping (after validation)

- Narrow `remote.urls` to the exact tenant hostnames (PH, UK) instead of `*.ilovelawyer.com`.
- Trim `core:default` to `core:event:default` plus the two commands.
- Turn on a CSP (`app.security.csp` is `null`). Page-to-Rust IPC is now enabled, so an XSS in the web app can call these commands. The spreadsheet-preview finding in `ilovelawyer-app/docs/evaluation-2026-09-24.md` matters more because of this.
- Show a native "Can't reach I Love Lawyer" window with Retry when the health check fails. Today the app just never opens a window.
- Decide the production frontend default (remote vs. bundled). If remote: bake the tenant URL in per build (PH / UK) rather than reading `.env` on the user's machine, and drop the sidecar, the Node binary and `bundle.resources`.
