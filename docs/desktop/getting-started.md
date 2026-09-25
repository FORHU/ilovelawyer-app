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
- (Later) notice that *other* applications' windows opened or moved

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

Both live in [`../../src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs):

- `open_case_terminal(caseId)` — opens (or focuses) that case's Terminal window
- `open_panel_window(caseId, panelId)` — pops a panel out into its own window

### The events that exist today

- `panel-window-closed` — a popped-out panel window was closed, so the Terminal that
  popped it out can put that pane back on its grid

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
│   └── lib/desktop/index.ts    ← THE BRIDGE. Start here.
├── src-tauri/
│   ├── src/lib.rs              ← all the Rust. Commands, windows, lifecycle.
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
physical pixels and logical (DPI-scaled) pixels. Tauri works in logical. If you start
calling raw Windows APIs, they return physical, and mixing the two silently breaks
positioning on any display that isn't at 100% scaling. Convert once, at the boundary.

**"Where's the window-detection code?"** It doesn't exist yet. See below.

---

## 12. What is NOT built yet

Don't go looking for these — they're planned, not written:

```text
Detecting other applications' windows   ← the next big feature
Tracking windows as they move
Associating a panel with an external window
Automatic rules
Verified production packaging / installer
```

The current Rust only manages **its own** windows. It has never looked at the rest of
your desktop. Adding that means Win32 work — `EnumWindows` for an initial scan plus
`SetWinEventHook` for live events, on a dedicated thread with its own message pump.

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
| **Logical vs physical pixels** | Same screen, two coordinate systems, differing by the display's scale factor (125%, 150%…) |
