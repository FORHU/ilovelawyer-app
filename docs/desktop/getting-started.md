# The Desktop App: How It Works

A beginner's guide to the Tauri shell in this repo — what it is, how it talks to the
Next.js app, and how to run it. No prior Tauri knowledge assumed.

Once this makes sense and you want to *build* something, see
[`adding-features.md`](adding-features.md) — the separation of responsibilities and the
recipes for adding commands and events.

---

## 1. The one-sentence version

**I Love Lawyer is one Next.js web app. The desktop build wraps that same web app in a
native Windows program so it can do things a browser is not allowed to do — mainly:
open real Windows windows and place them across your monitors.**

There is no second UI. There is no separate desktop frontend. The desktop app loads the
exact same pages you see at `localhost:3002` in Chrome.

---

## 2. Why this exists

A browser tab cannot:

- Open a genuinely separate OS window that you can drag to another monitor
- Know how many monitors you have, or where they are
- Position a window at specific screen coordinates
- Notice *other* applications' windows — which one you were last in, so a panel can dock
  beside it (see [Window Intelligence](#window-intelligence-docking-beside-other-apps))

Lawyers work across multiple screens with many documents open. That's the whole reason
for the native layer. Everything else — cases, auth, documents, the API — stays in the
web app exactly as it already is.

---

## 3. The mental model

```text
                    ONE Next.js application
                              │
              ┌───────────────┴───────────────┐
              │                               │
        Open in Chrome                  Open the .exe
              │                               │
      Runs as a website              Runs inside Tauri
              │                               │
   Panels open as popups          Panels open as real windows
```

The same React components, routes and API calls run in both. The only difference is
*how* a "new panel" gets opened — and one small file decides that (see §6).

---

## 4. What's actually running (dev mode)

When you develop the desktop app, **three processes** are alive:

```text
┌─────────────────────────────────────────────────────┐
│ 1. next dev          (Node)   serves localhost:3002 │
├─────────────────────────────────────────────────────┤
│ 2. ilovelawyer-desktop.exe  (Rust)  the native app  │
│      └── 3. WebView          (Edge)  renders the UI │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
                  ilovelawyer-api  (separate repo)
```

1. **Next.js** is just… Next.js. Nothing about it knows Tauri exists.
2. **The Rust program** is the native shell. It creates windows and does OS work.
3. **The WebView** is an embedded browser (Edge WebView2 on Windows). Each native window
   contains one, and each one loads a URL from `localhost:3002`.

So a "Case Terminal window" is a real Windows window containing a browser that is
pointed at `http://localhost:3002/homepage/terminal/{caseId}`.

> **In production it's slightly different:** there's no `next dev`, so the app ships a
> copy of Node plus a built Next.js server and starts it itself ("the sidecar"). That
> path exists in code but **is not currently verified working** — see the header comment
> in `scripts/stage-web.js`.

---

## 5. How the two sides talk

Two directions, two mechanisms. This is the core thing to understand.

### Next.js → Rust: **commands** (ask for something)

```text
React component
      │  invoke("open_case_terminal", { caseId })
      ▼
   Rust function marked #[tauri::command]
      │
      ▼  creates the window
   returns Ok / Err
```

### Rust → Next.js: **events** (tell everyone something happened)

```text
Rust notices a window closed
      │  app.emit("panel-window-closed", payload)
      ▼
Every open window receives it
      │
      ▼
React updates its layout
```

The rule of thumb:

| | |
|---|---|
| **Command** | "Please do this." Request/response. Started by the UI. |
| **Event** | "This just happened." Broadcast. Started by Rust. |

### The commands that exist today

All live in [`../../src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs):

- `open_case_terminal(caseId)` — opens (or focuses) that case's Terminal window
- `open_panel_window(caseId, panelId, besideWindow?)` — pops a panel out into its own
  window; with `besideWindow`, docks it beside another app's window (see
  [Window Intelligence](#window-intelligence-docking-beside-other-apps))
- `current_dock_target()` — the other app's window a panel can be docked beside right now,
  or null

### The events that exist today

- `panel-window-closed` — a popped-out panel window was closed, so the Terminal that
  popped it out can put that pane back on its grid
- `dock-target-changed` — the user switched to a different app's window (or the tracked
  one closed); payload is the new dock target or null

---

## 6. The one file that hides all of this

[`../../apps/web/lib/desktop/index.ts`](../../apps/web/lib/desktop/index.ts) is the
**bridge**. It is the only place in the web app that knows Tauri might exist.

Components never check "am I on desktop?" They just call:

```ts
openCaseTerminal(caseId)   // returns true if it handled it
```

and the bridge decides:

```text
Is window.__TAURI__ present?
        │
   ┌────┴────┐
  YES        NO
   │          │
invoke()   window.open()   ← a normal browser popup
```

That's why the browser build still works perfectly: every desktop feature has a real web
fallback, not a disabled button.

**A detail worth knowing:** the bridge talks to Tauri through a global variable,
`window.__TAURI__`, rather than importing the `@tauri-apps/api` npm package. That's
enabled by `"withGlobalTauri": true` in
[`../../src-tauri/tauri.conf.json`](../../src-tauri/tauri.conf.json). The reason: the web
app then has **zero desktop dependencies** in its `package.json`, so a pure web deploy
ships nothing Tauri-related.

---

## 7. Walkthrough: clicking "open case"

Trace it end to end — this is the whole system in one flow.

```text
1. User clicks a case in the UI
        ↓
2. Component calls openCaseTerminal("abc123")
        │  apps/web/lib/desktop/index.ts
        ↓
3. Bridge sees window.__TAURI__ exists
        │  → invoke("open_case_terminal", { caseId: "abc123" })
        ↓
4. Rust receives it
        │  src-tauri/src/lib.rs
        ↓
5. Rust validates the id
        │  only letters/numbers/-/_ allowed — it goes into a URL
        ↓
6. Already open?  label = "case-terminal-abc123"
        │
   ┌────┴────┐
  YES        NO
   │          │
 focus    pick a monitor (prefer one the current window isn't on)
   │          │
   │      build the URL: localhost:3002/homepage/terminal/abc123
   │          │
   │      create a native window, maximized on that monitor
   └────┬─────┘
        ↓
7. The new window's WebView loads that Next.js page like any browser would
```

Note step 6: the window **label** (`case-terminal-abc123`) is how duplicates are
prevented. Ask for the same case twice and the second call just focuses the first window.

---

## 8. How to run it

```powershell
# 1. One-time machine setup
winget install --id Rustlang.Rustup -e --accept-package-agreements --accept-source-agreements
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --accept-package-agreements --accept-source-agreements --override "--wait --quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
# open a new terminal, then verify: rustc --version / cargo --version

# 2. Install deps
cd ilovelawyer-app
npx pnpm@10.33.4 install

# 3. Two gitignored local files cargo/Tauri needs to even compile
copy "$(where.exe node)" src-tauri\binaries\node-x86_64-pc-windows-msvc.exe
mkdir C:\.ilw-build\web-standalone

# 4. Config (also gitignored) — src-tauri\.env
#   FRONTEND_URL=https://uk-dev.ilovelawyer.com
#   WINDOW_TITLE=I Love Lawyer Terminal! (uk-dev)
# apps\web\.env
#   NODE_ENV=development
#   NEXT_PUBLIC_API_URL=http://localhost:3001
#   NEXT_PUBLIC_GOOGLE_CLIENT_ID=placeholder-not-configured

# 5. Run
npx pnpm@10.33.4 tauri dev
```

Switching URLs later: edit `FRONTEND_URL` in `src-tauri\.env`, rerun step 5 — no rebuild needed.

**If you're only doing web work**, skip Tauri entirely and run `pnpm dev` — it's a normal
Next.js app.

**If `pnpm dev` is already running** in another terminal, `tauri:dev` will **fail outright**
— not just print a warning. `beforeDevCommand` unconditionally tries to bind port 3002
again, `next dev` exits with `EADDRINUSE`, and Tauri treats that as a failed prerequisite
and aborts before ever launching the Rust app (`ELIFECYCLE ... exit code 1`). Stop the
standalone `pnpm dev` first — there is no working "both at once" using two servers.

**To view it in a browser tab *and* the desktop window at the same time**, you don't need
two servers — just open `http://localhost:3002` in a normal browser while `tauri:dev` is
running. Both are loading the same Next.js instance, so they share hot reload and state
changes identically. That's the supported way to get both.

**On exit:** Tauri tries to stop the Next.js process it started, but child-process cleanup
on Windows isn't perfectly reliable. If port 3002 seems stuck after you quit, look for a
stray `node` process.

### Editing code

- **Change a React file** → hot reload, same as normal web dev. The desktop app picks it
  up instantly because it's just loading your dev server.
- **Change a Rust file** → Tauri rebuilds and relaunches the app automatically.

---

## 8b. Does the desktop app get my Next.js changes?

In dev, always — it's pointed at your dev server, so it behaves like any browser tab.

In production the answer depends on **which URL the shipped app loads**, and that's a
deployment decision, not a code one. `Config::base_url()` in `src-tauri/src/lib.rs` picks
between two modes:

| Mode | How it's set | Where windows load from |
|---|---|---|
| **Bundled sidecar** (default) | nothing set | a Next.js server the app starts itself, on `localhost:3002` |
| **Remote** | `FRONTEND_URL=https://…` | that deployed server |

Which gives:

| You changed | Dev | Prod — bundled | Prod — remote |
|---|---|---|---|
| React / Next.js | instant | **new installer** | **just deploy the web app** |
| Rust / `src-tauri` | auto relaunch | new installer | new installer |
| `tauri.conf.json` | restart | new installer | new installer |

**The consequence worth planning around:** in bundled mode, the web app and the desktop
app are welded together — every frontend fix ships as a new `.exe` that users must
install. In remote mode they're decoupled, and the desktop app becomes a thin native
shell you rarely need to re-release.

That makes remote mode much more attractive for anything shipping regularly. It also
means the desktop app needs the deployment to be reachable — offline, it has nothing to
load, whereas the bundled build still opens.

Neither production path is verified yet. Today only `tauri dev` is known to work.

---

## 9. The rules (please don't break these)

> **Next.js owns what I Love Lawyer *is*. Rust owns what Windows *can do*.**

| Belongs in Next.js / the API | Belongs in Rust |
|---|---|
| Cases, clients, documents | Creating / closing windows |
| Authentication | Positioning windows |
| Business rules | Detecting monitors |
| API calls | Focus, minimize, visibility |
| React state, navigation | Talking to the Windows API |

**Concretely:** Rust should never decide *whether a case can be closed*. It should only
*open the window that shows the case*.

If you find yourself adding case logic, auth, or an API call to `lib.rs`, stop — it
belongs on the other side of the bridge.

---

## 10. Where things live

```text
ilovelawyer-app/
├── apps/web/
│   └── lib/desktop/
│       ├── index.ts            ← THE BRIDGE. Start here.
│       └── use-dock-target.ts  ← React hook: the current dock target
├── src-tauri/
│   ├── src/lib.rs              ← commands, our own windows, lifecycle
│   ├── src/window_intel.rs     ← Win32: watches OTHER apps' windows (Windows only)
│   ├── src/main.rs             ← 6 lines; just calls into lib.rs
│   ├── tauri.conf.json         ← ports, bundling, window settings
│   ├── capabilities/           ← Tauri permissions (keep minimal)
│   ├── .env                    ← desktop-only config (port, window title)
│   └── frontend-dist/          ← a placeholder; see below
├── scripts/stage-web.js        ← production packaging (UNVERIFIED)
└── docs/desktop/               ← you are here
```

**`frontend-dist/` is a decoy.** It holds one near-empty `index.html`. Tauri requires a
"frontend directory" to exist, but this app never uses it — every window loads a URL from
the Next.js server instead. Don't put anything there.

---

## 11. Gotchas that will confuse you

**"I changed `.env` and nothing happened."** `src-tauri/.env` is read by the Rust program
at startup only. Restart `tauri:dev`. Also note `tauri.conf.json` does *not* read `.env` —
if you change the port, change it in both places.

**"The window title is weird."** It's `productName` in `tauri.conf.json`, overridable by
`WINDOW_TITLE` in `src-tauri/.env`.

**"Closing a window closed the whole app."** By design — closing the **main** window exits
the app. Closing a Case Terminal doesn't. And closing a window that popped out panels
closes those panels too, so none are orphaned.

**"Why is the panel label `panel-abc:notes` and not `panel-abc-notes`?"** Because case ids
can contain `-`. With a `-` separator, `("case-1", "notes")` and `("case", "1-notes")`
produce the same label, and the second pop-out would focus the wrong window. There's a
test for exactly this in `lib.rs`.

**"Coordinates are wrong on my second monitor."** Windows has two coordinate systems —
physical pixels and logical (DPI-scaled) pixels. Tauri's builder APIs mostly take logical;
raw Windows APIs return physical. Mixing the two silently breaks positioning on any display
that isn't at 100% scaling. `window_intel.rs` avoids the problem by staying in physical
pixels end to end (tao makes the process per-monitor-v2 DPI aware, so Win32 and Tauri's
`Physical*` types agree) — keep it that way rather than converting halfway.

**"The Dock beside button never shows up."** It only appears in the desktop app, and only
once you've been in another app's window since launch. The taskbar, desktop, Start menu,
Alt+Tab and this app's own windows deliberately don't count.

**"My command works in `pnpm dev` but not in the desktop app."** Or: `"<command> not allowed.
Plugin not found"`. A page only gets the app's own commands if the capability grants them by
name — see `adding-features.md` §3, step 2b. Only the dev-server origin (`devUrl`) is treated
as local and exempt, so this looks fine in `tauri:dev` on `localhost:3002` and fails on every
other URL the app ever loads, including `https://*.ilovelawyer.com` and a tenant host like
`ph.localhost:3002`. Verified live: the same `invoke` was rejected on `ph.localhost:3002` and
accepted on `localhost:3002` before the grants existed.

---

## Window Intelligence: docking beside other apps

The first slice of the desktop app's main differentiator: knowing about **other**
applications' windows. Today it does one thing — each Terminal pane header gets a
**Dock beside \<app\>** button that pops the panel out and places it against the window
you were last in (say, Chrome on a court site): to its right if there's room, else its
left, else over the screen's right edge. If that window has closed or been minimized by
then, the panel opens in its usual place instead.

How it works, in [`../../src-tauri/src/window_intel.rs`](../../src-tauri/src/window_intel.rs):

- A dedicated thread installs `SetWinEventHook` for foreground changes and window
  destruction, and pumps messages forever. Never Tauri's UI thread.
- It remembers **one** window: the last external one to take the foreground, and emits
  `dock-target-changed` whenever that changes.
- This app's own windows are ignored, so docking a panel (which takes the foreground)
  can't retarget itself.
- When the tracked window closes, the target does **not** usually become null — closing it
  hands the foreground to whatever was behind, and that becomes the new target. The button
  keeps showing, naming the next app. It only disappears when there is no ordinary external
  window left at all, which in practice means you have to have closed everything.
- Docking is best-effort by design: if the window has closed, been minimized, or simply
  isn't the target any more by the time you click, `target_geometry` fails, the Rust side
  logs `docking skipped, using default placement`, and the panel still opens where it
  normally would. Verified live.

Rules for anyone extending it:

- **Window titles are sensitive** — they carry client names and medical records. They
  may be *shown* in the UI (the user can already see that window), but must never be
  logged, stored, or sent to the API. That includes Rust error strings.
- **HWNDs never leave Rust.** The web app gets an opaque `runtimeId`. HWNDs are reused
  by Windows and don't survive a restart, so they are not identity; nothing persists an
  external window's association with a case.
- Docking is always the user's click. No automatic matching yet.

---

## 12. What is NOT built yet — and where to pick up

### The goal (don't lose this)

> **The desktop app earns its place by knowing about the *other* windows on a lawyer's
> screen** — the court site in Chrome, the brief in Word — and putting the right case
> panel next to them. Multi-window layout was the easy part and is already done; Window
> Intelligence is the differentiator. Case association and panel automation are
> *consumers* of it, not its foundation.

Build order we agreed, and where we are:

```text
1. Move src-tauri into this repo ................ DONE
2. Verify the unified repo (tauri dev) .......... DONE  (production build: NOT verified)
3. Win32 tracer bullet .......................... DONE, SEEN WORKING LIVE
4. Connect it to the existing panel system ...... DONE  (Dock beside = existing pop-out)
5. Extract a minimal bridge ..................... DONE  (DockTarget / useDockTarget)
6. Expand — only on need we actually observed ... NEXT  ← you are here
```

### Returning point (last worked on 2026-09-27)

> Picking up where this left off? [`../next-session.md`](../next-session.md) is the short list of
> what's open across both repos, including how to get the local stack running again. This section
> is the detail behind its desktop items.

**Dock beside has now been driven in the running app** and placement checked by measuring
window rectangles in physical pixels, not by eye. Two bugs were found and fixed doing it.

What was verified, on a single 3840×2160 display at 300% scaling (work area 3840×2016):

| Case | Expected | Measured |
|---|---|---|
| Target left of centre | flush against its right edge | target `R=1935` → panel `L=1935` ✓ exact |
| Target near the right edge | flips to its left | panel `L=335`, `R=2015` = target `L` ✓ exact |
| Target maximized | overlaps work-area right edge | panel `L=2160` = `3840−1680` ✓ exact |
| Target no longer current | normal placement, no failure | logged `docking skipped`, panel opened ✓ |
| Taskbar, Start, our own windows | target unchanged | stayed on the previous app ✓ |
| `dock-target-changed` reaching React | label follows the foreground | events arrived in order ✓ |
| Button label | names the app | `Notepad`, `chrome`, `msedge`, `Code` ✓ |

Found and fixed:

- **App commands were rejected on every origin except the dev server** — see §11's gotcha.
  This would have broken Dock beside *and* pop-out on the deployed `*.ilovelawyer.com`
  builds, not just locally. Needed a `tauri_build::AppManifest` in `build.rs` plus
  `allow-*` grants in the capability.
- **A 15px gap** between panel and target: Tauri positions the whole window, invisible
  resize borders included (15px per side at 300%), so the visible frames didn't meet.
  `dock_panel` now grows the rect by `window_intel::invisible_borders`. That alone was
  enough — an earlier second `dock_panel` pass after `show()` turned out to be unnecessary
  and was removed.

Still unverified — **start here**:

1. **Second monitor at a different scaling %** — the one case with no coverage, because the
   machine this ran on has a single display. `place_beside`'s negative-coordinate unit test
   covers the arithmetic, but nothing has checked that Tauri's physical coordinates and
   `GetDpiForWindow` agree once a second monitor with its own scale factor is involved.
   This is the highest-value remaining check: it is exactly where physical/logical pixel
   confusion shows up.
2. **The "elevated process" label fallback** — a process we can't inspect should give
   `appName: null` and the label "Dock beside your last window". The code path is clear
   (`process_name` returns `None` when `OpenProcess` fails) but it was never exercised;
   Task Manager on this machine wasn't elevated enough to trigger it.
3. **The minimized-but-still-current target** — hard to arrange, because minimizing a window
   hands the foreground to another app, which legitimately retargets. It returns `Err` and
   falls back exactly like the stale case above, which *is* verified, so this is a
   completeness gap rather than a risk.

Note for whoever automates this again: a browser or editor that keeps grabbing the
foreground will retarget between "decide the target" and "click the button", so trust the
button's own label at click time rather than anything read beforehand.

### Next, roughly in order

```text
A popped-out pane can be stranded (see below)    ← not new, but now easier to hit
Following a docked window as it moves/resizes   (EVENT_OBJECT_LOCATIONCHANGE, filtered
                                                 to the one target — it fires constantly)
Friendly app names ("Google Chrome", not "chrome")
Choosing among several windows, not just the last one used (EnumWindows scan + picker)
Stable monitor identity (device path / QueryDisplayConfig — NOT \\.\DISPLAY1, which
                         reshuffles when a monitor is replugged)
Automatic rules — patterns go INTO Rust, only a rule id comes back out, so a window
                  title never leaves the native layer
Verified production packaging / installer (sidecar paths likely need updating since src-tauri moved)
```

### Flagged while testing: a popped-out pane can be stranded

Not caused by Window Intelligence — it's in the pop-out feature itself, which docking just
gives another route into. `popOutPanel` marks the pane `visible: false`, and the Terminal's
autosave persists that to the workspace's `layoutJson` about 1.2s later. The pane is restored
by the `onPanelWindowClosed` handler — **but only if that event arrives.** If the app restarts
while a pane is out (a Rust rebuild in dev, a crash, quitting, or the owner window closing),
the saved layout still says hidden and there is no window left to send the event. Observed
directly: a 2-pane workspace came back with one pane after a `tauri:dev` rebuild.

Recoverable — re-add the pane from the Panel Library — but it looks like a pane silently
vanished from a saved workspace. Smallest fix: don't let pop-out state reach the persisted
layout (keep the popped-out set in memory), or reconcile against the shell on mount and show
any pane whose window no longer exists. Left undone deliberately: it is a pop-out concern, not
a docking one, and worth fixing on its own rather than inside this branch.

### Also noted: the API's tenant host map is missing `*.localhost`

`ilovelawyer-api/src/utils/tenant-host.ts` lists `ph.ilovelawyer`, `ph.ilovelawyer.local` and
the `.com` forms, but not `ph.localhost` / `uk.localhost` — which the web app's own copy in
`apps/web/lib/tenant-code/resolve-host.ts` does list, and whose comment says to keep the two in
sync. So a request from `http://ph.localhost:3002` gets "Unable to determine tenant from request
origin" and organization creation fails there. Worked around during testing by creating the
organization with a `ph.ilovelawyer.local` origin. Fix belongs in the API repo.

### Decisions already made — don't re-litigate

- **Titles:** shown live in the UI only. Never logged, stored, or sent to the API.
- **Identity:** HWND and PID are runtime handles, not identity. Association with a
  window is session-only and user-confirmed; nothing persists HWND → case.
- **Events:** `EVENT_SYSTEM_FOREGROUND`, not `EVENT_OBJECT_FOCUS` (fires per control);
  `EVENT_OBJECT_SHOW`, not `CREATE` (no title yet at create time).
- **Threads:** hooks live on their own thread with a message pump, never the UI thread.
- **Feedback loop:** our own windows are ignored, or opening a panel would retarget
  itself.
- **Don't build ahead:** event coalescing, a multi-window tracker and fancier DPI
  handling wait until we've *observed* the problem they solve.

---

## 13. Glossary

| Term | Meaning |
|---|---|
| **Tauri** | Framework for building desktop apps where the UI is a web page and the native part is Rust |
| **WebView** | Embedded browser inside a native window (Edge WebView2 on Windows) |
| **Command** | A Rust function the JavaScript side can call, via `invoke()` |
| **Event** | A message Rust broadcasts to the web side, via `emit()` |
| **Sidecar** | A helper program bundled with the app — here, Node running the built Next.js server |
| **Label** | Tauri's unique name for a window, e.g. `case-terminal-abc123` |
| **HWND** | Windows' internal handle for a window. Used by the OS, not exposed to the web side |
| **Dock target** | The other app's window you were last in, which a panel can be docked beside. The web side sees it as `{ runtimeId, appName, title }` |
| **Logical vs physical pixels** | Same screen, two coordinate systems, differing by the display's scale factor (125%, 150%…) |
