# Tauri desktop shell for I Love Lawyer Terminal

## Decision

Create a new, standalone repository — not a rewrite of I Love Lawyer, and not a package inside `ilovelawyer-app`:

```
ilovelawyer/
├── ilovelawyer-app/          existing Next.js application (its own git repo, unchanged)
├── ilovelawyer-api/          existing API (its own git repo, unchanged)
└── ilovelawyer-desktop/      new Tauri desktop shell (its own git repo)
    └── src-tauri/
        ├── src/main.rs, lib.rs
        ├── Cargo.toml
        └── tauri.conf.json
```

`ilovelawyer-desktop`'s job is monitor detection, native window management, desktop lifecycle, and launching the existing Next.js application — nothing else.

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
                         Existing Next.js
                          ilovelawyer-app
                               │
                         Existing API
                          ilovelawyer-api
```

**Core rule: Tauri owns the desktop. Next.js owns the application.** Tauri never implements cases, panels, authentication, Terminal state, API logic, or business rules — Next.js keeps owning all of that, unmodified.

## Key findings that shape the approach

- **Auth must not change.** `lib/fetch.ts` and `next.config.ts` (`ilovelawyer-app/apps/web`) route every `AUTH_PATHS` call through a Next.js server-side rewrite so `Set-Cookie` for the httpOnly `refreshToken` cookie lands on the app's own origin (see `next.config.ts` rewrites + `output: "standalone"`, and the explicit comment in `fetch.ts` explaining why). If Tauri's webview pointed at a remote origin directly, this proxy trick breaks. **Fix: don't change the origin story at all** — run the existing Next.js standalone server as a local sidecar process inside the Tauri app, and point every webview window at `http://localhost:<port>`. Same origin, same rewrite, same cookie behavior as today.
- **Multi-window already has precedent in this codebase.** `components/terminal/legal-terminal.tsx` already opens per-panel pop-out windows via `window.open`, and each pop-out is a fully independent browsing context that re-hydrates its own auth/org/socket state (the code comments explicitly say there is no cross-window sync — by design). Opening full Terminal windows per monitor follows the same model one level up. See `terminal-panel-popout.md` for the existing feature's full mechanics.
- Case assignment is **not** part of this pass — every window opens to the case picker; per-window "last case" persistence is an explicit non-goal for now.

## Phase 1 — Create the Tauri project

```
ilovelawyer-desktop/
├── package.json
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/
    │   └── default.json
    └── src/
        ├── main.rs
        └── lib.rs
```

- Initialize `ilovelawyer-desktop` as its own git repository (the parent `ilovelawyer/` directory isn't a git repo — each project underneath is independently git-initialized, same as `ilovelawyer-app`/`ilovelawyer-api` already are).
- Do **not** add it to the `ilovelawyer-app` pnpm workspace — its `package.json` has no `workspace:*` dependencies on `@workspace/*`. Its only link to `ilovelawyer-app` is reading that repo's *build output* by relative filesystem path (Phase 8), not a package dependency — this assumes both repos stay checked out as siblings under the same parent folder, same as they are today.
- Do **not** modify `ilovelawyer-app` during scaffolding — Tauri deps (`@tauri-apps/cli`, `@tauri-apps/api`, `tauri-plugin-shell`) live only in the new repo.
- **Orphaned branch note**: `feature/tauri-desktop-shell` was created inside `ilovelawyer-app` earlier in this project's planning, before this sibling-repo layout was settled on. It's unused under this plan — `ilovelawyer-app` needs zero commits for this feature. Left as-is (harmless) rather than deleted, since deletion wasn't asked for.

## Phase 2 — Build only the runtime PoC first

Do not implement the production sidecar yet. Run the existing application normally and have Tauri load it directly:

```
ilovelawyer-app: pnpm --filter web dev  →  http://localhost:3002
                                              │
                                              ▼
                      Tauri loads http://localhost:3002/homepage/terminal
```

The PoC does only this:

```
Application launch
       ↓
available_monitors()
       ↓
sort monitors by x, then y
       ↓
create WebviewWindow for each monitor
       ↓
position window
       ↓
maximize window
       ↓
load /homepage/terminal
```

No sidecar, no Node bundling, no packaging — just monitors, windows, and the already-running dev server. **Blocker**: this needs the Rust toolchain (`rustc`/`cargo`), which isn't installed on this machine yet — that has to be resolved before Phase 2 can run at all.

## Phase 3 — Verify the three unknowns

Nothing in this codebase has done any of this before, and only Tauri's actual runtime can answer these — not reading source. Verify all three on the actual Windows multi-monitor machine this will run on before writing anything past the PoC.

**A. Monitor positioning** — confirm: one window per physical monitor; left-to-right ordering; stacked-monitor (same-x) ordering falls back to the y secondary key correctly; mixed-DPI behavior (monitors at different scale factors); correct maximization; Windows taskbar stays accessible; normal title bar/window controls stay visible (i.e., this is genuinely maximized, not fullscreen).

**B. Authentication** — log in through one Terminal window, reload another, confirm whether the refresh-token cookie/session is actually available there. Do not assume the "one webview data store → shared cookie jar" claim in Key Findings holds until this test succeeds.

**C. Existing panel pop-outs** — from a Tauri Terminal window, trigger `popOutPanel()` → `window.open()` (see `terminal-panel-popout.md`). Determine whether the resulting popup is a Tauri-tracked `WebviewWindow` or an independent WebView2-level popup outside Tauri's registry. This result determines the correct implementation mechanism for Phase 5's "panel pop-outs close with their parent Terminal" rule — the *architectural* requirement is decided already (below); only the *mechanism* waits on this test.

If Phase 2/3 pass, the rest of this plan (Phases 6-9) is integration — adding the sidecar and packaging — not redesign.

## Phase 4 — Keep Terminal windows independent

For N monitors:

```
Monitor 1 → Terminal Window → case selected independently
Monitor 2 → Terminal Window → case selected independently
Monitor 3 → Terminal Window → case selected independently
```

- Every window starts at `/homepage/terminal` (the case picker) — no automatic case assignment.
- No "primary" Terminal window, no shared React state, no Tauri-side case state. Each WebView is a fully independent instance of the existing Next.js app: own QueryClient, own Zustand state, own Socket.IO connection, own auth hydration (`app/(protected)/layout.tsx` runs fresh in each).
- A window isn't case-locked: the same window can later navigate to a different case's Terminal (via the existing case-portfolio drilling path — there's no dedicated case-switcher, see `frontend-architecture.md` §3), same as any browser tab today.
- Don't introduce a Tauri-side global state manager or cross-window coordination unless a real, demonstrated cross-window requirement appears later — none exists today.

## Phase 5 — Window lifecycle

Explicit rules, not left to default behavior to be discovered later:

- **Closing one Terminal window closes only that window.** The other windows are unaffected. No primary window, no quit-the-whole-app-on-one-close behavior.
- **No window recreation.** If the user closes a window, its monitor simply goes unused for the rest of that session — no live monitor-hotplug or window-close watcher that respawns it.
- **When the last window closes, the application is expected to exit naturally under the normal Tauri lifecycle — no special handling is planned.** This is intentionally not implemented through primary-window bookkeeping or custom exit logic. Tauri's documented default is that the process exits once the last window closes, but actual behavior can depend on configuration/plugins/platform specifics — treated as an intended behavior to confirm during Phase 5 verification, not a guaranteed framework invariant to build on blindly. A primary window was considered specifically as a way to control this and rejected — see Phase 4 (no primary).
- **A Terminal window's panel pop-outs must close with it.** A pop-out is a detached view of a panel belonging to that Terminal, not an independent workspace. Today's `popOutPanel` implementation has no cross-window-close awareness — closing the parent currently leaves any pop-outs orphaned, running independently with no way to ever rejoin a grid. This is an existing gap in `legal-terminal.tsx`, not something new introduced by the desktop shell, but the desktop shell is where it starts to matter in practice. **Fix belongs in the frontend** (`legal-terminal.tsx`), not the Tauri/Rust layer: on the parent window closing, iterate `popupWindowsRef.current` and close each tracked popup. The exact lifecycle event to hook (`beforeunload`, `pagehide`, or a Tauri-specific close event) is decided by Phase 3C's result — verify against actual WebView2/Tauri behavior rather than assuming `beforeunload` fires reliably.

## Phase 6 — Keep monitor handling simple

```
detect monitors (available_monitors(), once, at launch)
    ↓
sort by x
    ↓
sort by y when x is equal
    ↓
create one window per sorted monitor
```

No persistent monitor identity is stored anywhere — a fresh, stateless sort every launch. Explicitly **not** implemented this pass: monitor hot-plug detection, automatic window recreation, persistent monitor identities, monitor-to-case persistence, tray management, manual per-monitor assignment. (A manual, user-triggered "open a Terminal on monitor X" action is a possible small follow-up later, as a lighter alternative to automatic recreation — not part of this pass.)

## Phase 7 — Use maximized windows

```
position on target monitor
        ↓
.maximized(true)
```

Not `.fullscreen(true)`. Maximized fills the monitor's actual work area (respects the taskbar) and keeps normal window chrome (title bar, controls); fullscreen would cover the taskbar and remove window controls, which isn't wanted here.

## Phase 8 — Production packaging (only after Phases 2-3 pass)

```
Tauri
  ↓
portable Node sidecar
  ↓
Next.js standalone server (ilovelawyer-app's existing output, unmodified)
  ↓
localhost:<port>
```

- Build target: `ilovelawyer-app`'s own `pnpm --filter web build` (already produces `.next/standalone/server.js` because `output: "standalone"` is already set) — run from within `ilovelawyer-app`; the desktop repo's build just expects that output to already exist.
- Package a portable Node runtime as a Tauri external binary (per-target-triple executable, e.g. `node-x86_64-pc-windows-msvc.exe`), per Tauri's documented sidecar convention. Referenced in `tauri.conf.json` via `bundle.externalBin`.
- `tauri.conf.json`'s `bundle.resources` points across the sibling-repo boundary at the built `ilovelawyer-app/apps/web/.next/standalone`, `.next/static`, and `public` output (relative path from `ilovelawyer-desktop/src-tauri/tauri.conf.json`: `../../ilovelawyer-app/apps/web/...`). This relative-path linkage assumes both repos stay checked out as siblings, same as today.
- In dev: skip the sidecar entirely (Phase 2's approach) — run `next dev -p 3002` from `ilovelawyer-app`, point Tauri's `devUrl` at `http://localhost:3002`.
- In prod: on app start (`src-tauri/src/lib.rs` `setup` hook), use `tauri-plugin-shell` to spawn `node server.js` (cwd = bundled standalone output, `PORT` env set), poll `http://localhost:<port>` until it responds (bounded retry loop), then proceed to window creation (Phases 4-7). Kill the sidecar process on app exit.
- The desktop build consumes the existing generated `.next/standalone` / `.next/static` / `public` artifacts as-is — it does not copy or rewrite Next.js source.
- Grant the needed Tauri v2 capabilities (`capabilities/default.json`): window creation and shell-execute permissions for the sidecar.

## Phase 9 — Keep repositories independent

```
ilovelawyer-desktop
        │  consumes build artifacts (relative path, not a package dependency)
        ▼
ilovelawyer-app
        │  API requests (unchanged)
        ▼
ilovelawyer-api
```

- No `@workspace/*` dependency from the desktop project.
- No duplicated Case Terminal implementation — every window loads the real, unmodified app.
- No authentication rewrite specifically for Tauri, unless Phase 3B's test proves the existing cookie-sharing mechanism cannot work as-is.

## Recommended implementation order

```
1.  Install Rust / rustup
2.  Create ilovelawyer-desktop, initialize git
3.  Scaffold Tauri v2 (Phase 1)
4.  Point Tauri at localhost:3002 (Phase 2)
5.  Implement monitor enumeration
6.  Sort monitors x, then y
7.  Create one window per monitor
8.  Position + maximize (Phase 7)
9.  Test mixed-DPI / stacked-monitor / taskbar behavior (Phase 3A)
10. Test cookie sharing (Phase 3B)
11. Test window.open() behavior (Phase 3C)
12. Record actual PoC results
13. Implement window lifecycle (Phase 5) and the panel-popup-close fix in legal-terminal.tsx, using Phase 3C's result to pick the mechanism
14. Implement Node sidecar (Phase 8)
15. Package standalone Next.js output
16. Test production build
```

## Files touched

- New repo: `ilovelawyer-desktop/**` (own `git init`, own history — `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`, `package.json`).
- `ilovelawyer-app`: no edits for the desktop shell itself. **One small follow-up fix does land here eventually** (Phase 5, last bullet): a `beforeunload`/`pagehide`-style handler in `components/terminal/legal-terminal.tsx` so panel pop-outs close with their parent window. That's a pre-existing gap the desktop shell surfaces, not desktop-specific code.
- No edits to `ilovelawyer-api/**`.
- `ilovelawyer-app`'s `feature/tauri-desktop-shell` branch: unused under this layout, left as-is (see Phase 1).

## Verification

1. **Phase 2/3 PoC**: from `ilovelawyer-desktop`, minimal window/monitor-only build pointed at `ilovelawyer-app`'s already-running `next dev` (`:3002`) — confirms monitor positioning/DPI/taskbar handling (3A), cross-window cookie sharing (3B), and `window.open()` tracked-vs-untracked behavior (3C) before anything else is built.
2. From `ilovelawyer-app`: `pnpm --filter web dev`. From `ilovelawyer-desktop`: `pnpm tauri dev` — confirm one window per connected monitor, each landing on `/homepage/terminal`, maximized (taskbar/title bar still visible), in left-to-right (then top-to-bottom for stacked) monitor order, and that logging in in one window makes the others authenticated on next reload.
3. Unplug/simulate a second monitor (or test with a multi-monitor VM) to confirm window count adjusts to the detected monitor count at next launch (not live).
4. Close one of several open Terminal windows: confirm only that window closes, the others are unaffected, its monitor stays empty for the rest of the session. Close every window: confirm the app process exits on its own, with no custom exit logic required.
5. Pop out a panel in one Terminal window, then close that window: confirm the popup closes with it rather than being left orphaned (once Phase 5's fix is implemented).
6. From `ilovelawyer-app`: `pnpm --filter web build`. From `ilovelawyer-desktop`: `pnpm tauri build` — confirm the sidecar starts the standalone server, the health-check/retry loop succeeds, and the packaged app behaves the same as dev mode without a system Node install present.
