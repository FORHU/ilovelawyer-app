# Production readiness

**Current status: proof of concept, not production-ready.** The core architecture works — monitor detection, window creation/positioning, the `localhost` CORS fix, config loading — all confirmed by actually running `tauri dev`. Nothing about *packaging and shipping this to a real user* has been verified. This doc is the gap list between "works on this dev machine" and "safe to hand to an actual lawyer."

See [`architecture.md`](architecture.md) for how the app works, and the main project's `implementation/tasks.md` (outside this repo) for the detailed build history behind each item below.

## Blocking — must be done before any real distribution

Roughly in the order they should be tackled, since later ones depend on earlier ones actually working.

### 1. Finish the PoC's own verification tests

Two of the three original risk tests were never actually completed:
- **Test 3B (auth/session sharing across windows)**: the CORS bug blocking this is fixed (`localhost` not `127.0.0.1`), but log-in-one-window/authenticated-in-another was never confirmed working end to end.
- **Test 3C (panel pop-out behavior when its parent window closes)**: not attempted at all yet — needs a real case with panels to test against, which needs 3B working first.

Shipping without these confirmed means shipping on the assumption the core interaction model works, not the knowledge that it does.

### 2. Panel-popup-closes-with-parent fix

**Implemented, not yet verified.** Panels in the desktop app are now native windows created by the shell (`open_panel_window`), which records the window that popped each one out and closes its panels when that window is destroyed (`handle_window_destroyed` in `src/lib.rs`) — no page-side lifecycle event needed. Still needs Test 3C run against it before this can be ticked off. (The browser build keeps `window.open` pop-outs, which still can't be closed with their parent.)

### 3. Real `tauri build` run, at least once

**Build half done (2026-09-25); launch half still open.** `tauri build` now completes end to end: the Next.js standalone build runs via `beforeBuildCommand`, `bundle.resources` stages `web-standalone/` (server.js, `.next/` statics, `public/`) next to the `node` sidecar, and NSIS produces `I Love Lawyer Terminal!_0.0.1_x64-setup.exe`. That was the first time this path had ever been run.

What remains: **install from that installer and confirm the app actually launches and works** — specifically that the sidecar spawns, serves, and that the windows can reach it. That last part is the risky bit, and is why the `HOSTNAME=localhost` fix landed first: the sidecar previously bound `127.0.0.1` while every window loads `http://localhost:<port>`, which are different addresses on this machine (`localhost` resolves to `::1` here), so the packaged app could not have reached its own server. See `architecture.md`'s gotchas for the full finding.

### 4. Real portable Node sidecar binary

`src-tauri/binaries/` currently has this machine's own system `node.exe` copied in as a stand-in, just to unblock compilation. That's not appropriate to ship — it needs a genuinely portable, redistributable Node build for each target platform/architecture (see `src-tauri/binaries/README.md` for the naming convention Tauri expects).

### 5. Production API URL strategy

`NEXT_PUBLIC_API_URL` (and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) get baked into the Next.js build at `next build` time — currently that's `http://localhost:3001`, which only works because a developer's own local API happens to be running. A real distributed build needs to point at an actual deployed, publicly-reachable API server. This also raises a design question not yet answered: does every installed copy of the desktop app point at one shared production API, or could different deployments (firm-specific?) need different API URLs baked into different builds? Worth deciding deliberately, not defaulting into.

### 6. Code signing

An unsigned NSIS installer trips Windows SmartScreen ("Unknown Publisher") — acceptable for internal testing, not for handing to real users who'll reasonably be suspicious of a scary warning before they've even opened the app. Needs a code-signing certificate and wiring it into the `tauri build` pipeline.

### 7. Security review of the Tauri config

`src-tauri/capabilities/default.json` currently grants broad `core:default` permissions — now to remote pages too (`http://localhost:*`, `https://*.ilovelawyer.com`), since the web app has to call `open_case_terminal`/`open_panel_window` — and `tauri.conf.json`'s `app.security.csp` is `null` (disabled). With page-to-Rust IPC enabled, an XSS in the web app can now call those commands, so trimming `core:default` down to just `core:event:default` (for `panel-window-closed`) plus the two commands is part of this item. Fine for a dev PoC loading a trusted local server; worth deliberately tightening before this loads a production API handling real client/case data. Scope this to what the app actually uses, not the default-open template state.

### 8. Real icons

Currently placeholder auto-generated "IL" squares (generated via a quick PowerShell script early in this project's setup, not real branding). Cosmetic, but "looks like a prototype" is a bad first impression for something lawyers are trusting with case data.

### 9. Mixed-DPI and stacked-monitor verification

Test 3A only confirmed the simple case: same-DPI monitors, left-to-right. The sort-by-x-then-y logic and per-monitor DPI scaling (`scale_factor()` in `src/lib.rs`) are written but not verified against an actual mixed-DPI or vertically-stacked multi-monitor setup.

## Explicitly deferred (not blocking, don't build yet)

Carried over from the main plan's scope decisions — still correct, restated here so this doc doesn't imply they're missing oversights: monitor hot-plug detection, automatic window recreation after a close, persistent monitor identity, monitor-to-case persistence, a system tray affordance, manual per-monitor "open Terminal here" action, auto-update/installer-update mechanism.

## A note on process

Nearly everything discovered in this project so far — the config schema bugs, the path-depth bug, the two Rust compile errors, the CORS mismatch, the `bcrypt` native-module issue — was found by *actually running the thing*, not by reasoning about the code. Nothing on this list should be marked done based on "the code looks right" alone; each item needs the same treatment: run it for real, on the actual target platform, and confirm the specific failure mode it addresses doesn't happen.
