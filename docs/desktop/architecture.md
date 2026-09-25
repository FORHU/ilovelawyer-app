# Architecture

> **Migrated 2026-09-25.** This doc was written when the desktop shell lived in its own
> `ilovelawyer-desktop` repo. That repo is retired and `src-tauri/` now lives here, in
> `ilovelawyer-app`. References below to "this repo" meaning the desktop shell, and to
> `ilovelawyer-app` as a separate checkout, describe the old layout. How the shell *works*
> is unchanged and still accurate. New to this? Start with
> [`getting-started.md`](getting-started.md). For current direction see
> [`implementation-plan.md`](../../implementation-plan.md) at the repo root.

**Scope:** the native desktop shell (`src-tauri/`). For the underlying application itself (Case Terminal, auth, API — what this shell wraps but never reimplements), see [`system-architecture.md`](../architecture/system-architecture.md). For what's still missing before this could actually ship, see [`production-readiness.md`](production-readiness.md) — as of this writing, this is a proof of concept, not production-ready. This doc is the standalone reference for the shell; the original planning history (extensive design Q&A, phase-by-phase decisions) lives in [`../architecture/`](../architecture/) — treat this file as the authoritative, current-state summary of that history, not a pointer to it.

## What this is

A thin native wrapper around the existing `ilovelawyer-app` Next.js web app. Its only job: own the native windows — open the main dashboard window at launch, then create, place and close Case Terminal and panel windows across monitors when the web app asks for them. Every window loads the real Next.js app.

```
                    I Love Lawyer Desktop
                    ┌─────────────────────┐
                    │       Tauri         │
                    │       Rust          │
                    │                     │
                    │ Monitor detection   │
                    │ Window management   │
                    │ Window lifecycle    │
                    │ Next.js sidecar     │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              WebView Window 1      WebView Window N
                    │                     │
                    └──────────┬──────────┘
                               │
                    Next.js app (ilovelawyer-app)
                               │
                    API (ilovelawyer-api)
```

**Core rule: Tauri owns the desktop, Next.js owns the application.** This repo never implements cases, panels, authentication, Terminal state, or API logic — it only orchestrates windows around the existing app, which is loaded exactly as-is.

## Repo layout

Since the 2026-09-25 migration, the shell lives inside this repo:

```
ilovelawyer-app/
├── apps/web/              Next.js app
│   └── lib/desktop/       the bridge
├── scripts/stage-web.js   production staging (UNVERIFIED — see below)
└── src-tauri/             the Tauri shell
```

`tauri.conf.json`'s `beforeBuildCommand` and `scripts/stage-web.js` now resolve `apps/web`
within this repo rather than reaching across to a sibling checkout. `bundle.resources` still
points at the hardcoded `C:\.ilw-build\web-standalone` staging root — that production path was
never verified, and the migration invalidated the relative paths it depended on.

## Dev mode vs. production mode

- **Dev**: `tauri dev` loads `http://localhost:3002` directly (`devUrl` in `tauri.conf.json`) — i.e. whatever `ilovelawyer-app`'s own `next dev` is already serving. No sidecar process, no bundling.
- **Production**: `tauri build` packages `ilovelawyer-app`'s Next.js **standalone** build output (`.next/standalone`, `.next/static`, `public`) as bundled resources, and spawns it as a local Node child process ("sidecar") on app startup, then waits for it to respond before opening any windows. The sidecar is killed on app exit (`src/lib.rs`, `RunEvent::Exit` handler).

Both modes ultimately point every window at the same URL shape (`http://localhost:<port>/homepage/terminal`) — the only difference is who's running the server behind that URL. Deliberately `localhost`, not `127.0.0.1`: the API's CORS allowlist (`CLIENT_URL`) is keyed off exact origin strings, and those two are different origins to a browser despite resolving to the same machine — see the findings below.

## Window/monitor management

Why it's built this way, the options considered, and the validation checklist: [`window-ownership-plan.md`](window-ownership-plan.md).

**Tauri is the window owner, not a window detector.** Every native window exists because Tauri created it, on an explicit request, under a label it chose — it never tries to find or move a window the page opened itself (that would mean picking one browser window out of many, which is fragile).

On startup (`src/lib.rs`, `setup` hook):

1. Wait for the web server to respond (either the dev server, already running, or the freshly-spawned sidecar).
2. Open one window, `main`, at `/homepage` (the dashboard), `.maximized(true)` on the primary monitor — **not** `.fullscreen(true)`, so it fills the real work area, respects the taskbar and keeps normal window chrome.

Everything after that is on demand. The web app asks for windows through two Tauri commands, via `ilovelawyer-app`'s `lib/desktop` bridge (which uses the `window.__TAURI__` global, enabled by `app.withGlobalTauri`, and falls back to ordinary web behavior in a browser):

| Command | Window label | Loads | Placement |
|---|---|---|---|
| `open_case_terminal({ caseId })` | `case-terminal-{caseId}` | `/homepage/terminal/{caseId}` | Maximized on the first monitor (left to right) that isn't the calling window's; same monitor if there's only one |
| `open_panel_window({ caseId, panelId })` | `panel-{caseId}:{panelId}` | `/homepage/terminal/{caseId}/panel/{panelId}` | 560×680 near the right edge of the calling window's monitor, cascading |

Both focus the existing window instead of creating a duplicate when that label is already open, so one case = one Terminal window. Ids are checked against `[A-Za-z0-9_-]{1,64}` before they become part of a label or URL path. Monitors are enumerated (and sorted by physical x, then y) on each call, so a monitor plugged in mid-session is used by the next window opened.

**Window lifecycle** (`handle_window_destroyed`):
- Closing `main` exits the app — closing every other window and stopping the sidecar.
- Closing a Case Terminal closes the panels it popped out (tracked in the `PanelWindows` owner map), so no panel is left orphaned.
- Closing a panel emits `panel-window-closed { caseId, panelId }`; the Terminal that popped it out puts the pane back on its grid.

Windows otherwise share no state — each runs its own QueryClient and Socket.IO connection, like separate browser tabs of the same origin.

**IPC scope** (`capabilities/default.json`): windows `main`, `case-terminal-*`, `panel-*`; pages from `http://localhost:*` and `https://*.ilovelawyer.com` only; `core:default` plus the app's own two commands. The shell plugin is not exposed to web pages.

## Real findings from actually building this (not just design assumptions)

A few things only surfaced once this was actually compiled and run — worth knowing before changing `tauri.conf.json` or `src/lib.rs`:

- **Tauri's build script validates `bundle.externalBin` and `bundle.resources` paths exist on disk even in `tauri dev`**, not only for `tauri build`. If the sidecar binary or the standalone build output is missing, the dev build fails outright, even though dev mode's own runtime code never touches either of them.
- **`beforeDevCommand`/`beforeBuildCommand` must be a plain string**, not the `{"command", "cwd"}` object form — the latter fails Tauri v2's config schema validation.
- Those commands run from **this repo's root** (where `package.json` lives), not from `src-tauri/` — relative paths in them need one fewer `../` than you'd expect if you assumed the latter.
- `src-tauri/gen/` (capability/permission schema JSON) is regenerated by Tauri on every build from `tauri.conf.json` + `capabilities/` — treat it as build output, not source (gitignored).
- **Windows must load `http://localhost:<port>`, not `http://127.0.0.1:<port>`.** `ilovelawyer-api`'s CORS middleware (`src/app.ts`) checks the request's `Origin` header against an exact-match allowlist (`CLIENT_URL`, `src/config.ts`) that lists `http://localhost:3002` but not the IP form. A CORS-blocked request doesn't surface as an obvious error in the UI — it just makes every data fetch hang, which looks identical to the backend simply not being up yet. If you ever see "windows open, picker loads forever, but `curl localhost:3001/api/health` returns 200," check this first.
- **`localhost` and `127.0.0.1` are different *addresses*, not just different origin strings.**
  The CORS finding above is about the origin string; this is about which socket you actually
  reach. On an IPv6-enabled machine `localhost` resolves to `::1` first, so a server bound to
  `127.0.0.1` is not reachable at `http://localhost:<port>` at all — and two processes can hold
  the same port simultaneously (one on `[::1]`, one on `127.0.0.1`) without either reporting
  `EADDRINUSE`, in which case the health check passes against whichever unrelated server got
  there first and the windows silently display *that* app. Observed directly on this project's
  dev machine. The sidecar therefore sets `HOSTNAME=localhost` rather than an IP, so it binds
  whatever the windows will resolve; keep that in sync with `Config::base_url`.
- **`beforeDevCommand` doesn't exist in this repo's `tauri.conf.json` on purpose.** It originally auto-started `ilovelawyer-app`'s `next dev`, but that collides (`EADDRINUSE`) with the common case of already having that dev server running in its own terminal. Dev mode here assumes you start `ilovelawyer-app` yourself first (README step 6) and just waits on `devUrl`.

## Files of note

- `src-tauri/src/lib.rs` — all the actual logic: sidecar spawn/health-check/kill, main window, the `open_case_terminal`/`open_panel_window` commands, window lifecycle.
- `src-tauri/tauri.conf.json` — dev/build commands, window/bundle config, `withGlobalTauri`.
- `src-tauri/capabilities/default.json` — Tauri v2 permission grants for `main`, `case-terminal-*` and `panel-*`, scoped to the allowed remote origins.
- `ilovelawyer-app/apps/web/lib/desktop/index.ts` (other repo) — the web side of the bridge: `openCaseTerminal`, `openPanelWindow`, `onPanelWindowClosed`.
- `src-tauri/binaries/` — expects a portable Node executable here for `tauri build` (see that folder's own README); not needed for `tauri dev`.
