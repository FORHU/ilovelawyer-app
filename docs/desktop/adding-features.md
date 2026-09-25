# Working Across the Boundary

How responsibilities are split between the Next.js app and the Rust shell, and the
practical recipes for adding something to either side.

New to the desktop app? Read [`getting-started.md`](getting-started.md) first — it
explains what Tauri is and how the pieces fit. This doc assumes that and gets practical.

---

## 1. The separation, precisely

```text
┌──────────────────────────────────────────────────────────┐
│  apps/web/            Next.js                            │
│                                                          │
│  Cases · clients · documents · auth · API calls · React  │
│  state · routing · every pixel the user sees             │
└─────────────────────────┬────────────────────────────────┘
                          │
              apps/web/lib/desktop/index.ts
                    THE ONLY CROSSING
                          │
┌─────────────────────────┴────────────────────────────────┐
│  src-tauri/           Rust                               │
│                                                          │
│  Create · position · focus · close windows · monitors ·  │
│  window lifecycle · (later) the Windows API              │
└──────────────────────────────────────────────────────────┘
```

**The rule:** Next.js owns what I Love Lawyer *is*. Rust owns what Windows *can do*.

**The test:** could this run in a browser? If yes, it belongs in Next.js. Rust is only for
what a browser is physically incapable of.

| Rust should | Rust should never |
|---|---|
| Open the window that shows a case | Decide whether a case can be closed |
| Put a panel on the second monitor | Know what a "panel" means to a lawyer |
| Report which windows exist | Call the API |
| Focus a window | Hold credentials or session state |

If you're writing `if case.status == ...` in `lib.rs`, stop. That logic is on the wrong
side of the line.

---

## 2. First question: do you need Rust at all?

Most features don't. Check honestly:

```text
Does it need a real OS window, monitor info,
or knowledge of other applications?
              │
        ┌─────┴─────┐
       NO          YES
        │            │
   Pure web      Read on.
   feature.      You'll touch both sides.
   Don't open
   src-tauri.
```

Anything that's a new page, a new API call, a new component, new state, new business
logic — that's `apps/web`, full stop. The desktop app picks it up automatically because
it's loading the same pages.

---

## 3. Recipe: adding a Tauri command

A **command** is a Rust function the web app can call. Four steps.

### Step 1 — Write it in `src-tauri/src/lib.rs`

```rust
#[tauri::command]
async fn focus_case_terminal(app: AppHandle, case_id: String) -> Result<(), String> {
    validate_id("caseId", &case_id)?;
    let label = format!("{CASE_TERMINAL_LABEL_PREFIX}{case_id}");
    if focus_existing(&app, &label) {
        Ok(())
    } else {
        Err("WINDOW_NOT_FOUND".into())
    }
}
```

Three things that matter here:

- **`async`** — creating or manipulating windows from a *synchronous* command deadlocks
  on Windows. Existing commands are async for exactly this reason.
- **`validate_id`** — any string that becomes part of a window label or URL must go
  through it. It rejects `/`, `..`, `?`, `@`, spaces and anything over 64 chars. Skipping
  it is how a caller escapes the URL's origin.
- **`Result<(), String>`** — errors cross as strings. Return a stable code
  (`WINDOW_NOT_FOUND`), not a raw Rust error or a sentence that might get reworded.

### Step 2 — Register it

```rust
.invoke_handler(tauri::generate_handler![
    open_case_terminal,
    open_panel_window,
    focus_case_terminal,   // ← add here, or it doesn't exist to the web side
])
```

### Step 3 — Expose it through the bridge

In `apps/web/lib/desktop/index.ts` — **not** in a component:

```ts
export function focusCaseTerminal(caseId: string): boolean {
  const t = tauri()
  if (!t) return false          // browser: caller falls back
  t.core.invoke("focus_case_terminal", { caseId }).catch((err) => {
    console.error("focus_case_terminal failed", err)
  })
  return true
}
```

Note the argument name: Rust's `case_id` arrives as `caseId`. Tauri converts snake_case
to camelCase across the boundary.

### Step 4 — Give the browser something real

This is the step people skip. Returning `false` is only acceptable if the caller has a
genuine web behaviour to fall back to:

```ts
if (!focusCaseTerminal(caseId)) {
  router.push(`/homepage/terminal/${caseId}`)   // the browser equivalent
}
```

The bridge is a **capability abstraction**, not a desktop detector. Every desktop feature
should degrade to the closest honest web behaviour — see how `openPanelWindow` falls back
to a real `window.open` popup, with polling to detect its close, because browsers give the
opener no close event.

---

## 4. Recipe: adding an event (Rust → React)

Use an event when Rust needs to announce something nobody asked for.

### Rust side

```rust
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct MonitorsChanged {
    count: usize,
}

app.emit("monitors-changed", MonitorsChanged { count: 2 }).ok();
```

`app.emit` reaches **every** window. That's usually what you want — any Terminal might
need to react — but it does mean each window's handler must decide whether the event is
for it.

### Web side

Wrap it in the bridge with an unsubscribe, following `onPanelWindowClosed`:

```ts
export function onMonitorsChanged(handler: (e: MonitorsChanged) => void): Unlisten {
  const t = tauri()
  if (!t) return () => {}       // browser: nothing ever fires

  let unlisten: Unlisten | null = null
  let disposed = false
  t.event.listen<MonitorsChanged>("monitors-changed", (e) => handler(e.payload))
    .then((fn) => { if (disposed) fn(); else unlisten = fn })
  return () => { disposed = true; unlisten?.() }
}
```

The `disposed` flag matters: `listen()` is async, so a component that unmounts before it
resolves would otherwise leak a live listener.

---

## 5. Window labels are your identity scheme

Every window has a unique **label**. It is how you find a window again, and how duplicates
are prevented.

```text
main                      the dashboard
case-terminal-{caseId}    one per case
panel-{caseId}:{panelId}  one per popped-out panel
```

Before creating a window, always check whether it exists:

```rust
if focus_existing(&app, &label) {
    return Ok(());   // already open — focus it, don't make a second
}
```

**The `:` separator is deliberate.** Case ids may contain `-`. With a `-` separator,
`("case-1", "notes")` and `("case", "1-notes")` collapse to the same label, and the second
pop-out would focus the first's window and report the wrong ids when closed. There's a
test pinning this — don't "tidy" it.

---

## 6. Security rules when adding commands

**Validate every id.** Anything reaching a URL or label goes through `validate_id`.

**Build URLs from validated parts only.** `external_url()` concatenates onto the base URL,
which is safe *because* ids can't contain `@`, `/` or `:`. If you ever add a command that
takes a caller-supplied *path*, that concatenation is no longer safe — resolve it against
the base URL and reject anything landing outside that origin.

**Know what the capability file gates.** `src-tauri/capabilities/default.json` controls
which windows and which origins may talk to Rust at all:

```json
"windows": ["main", "case-terminal-*", "panel-*"],
"remote": { "urls": ["http://localhost:*", "https://*.ilovelawyer.com"] }
```

A new window label that doesn't match those patterns gets **no IPC** — a frequent cause of
"my command silently does nothing." The shell plugin is deliberately absent from
`permissions`, so pages cannot spawn processes; keep it that way.

**Remember pages can be attacked.** Any XSS in the web app becomes more serious here,
because an injected script inherits the page's ability to call your commands. That's an
argument for keeping the command surface small and every command boring.

---

## 7. Anti-patterns

**Importing Tauri in a component.**

```ts
import { invoke } from "@tauri-apps/api/core"   // ✗ breaks the browser build
```

Go through the bridge. The web app deliberately has no Tauri dependency — the shell sets
`withGlobalTauri`, so the bridge reads `window.__TAURI__` instead.

**Scattering `if (isDesktop())` through the UI.** One or two checks at a call site is
fine. If it's spreading, the abstraction is in the wrong place — push the branch down into
the bridge.

**Business logic in Rust.** Covered above, and it's the one that's hardest to undo later.

**Passing HWNDs to the frontend.** Next.js can't call the Windows API, so a raw OS handle
is useless there and encourages treating it as a stable id, which it isn't — Windows
recycles handles. Give the web side an opaque id and keep handles in Rust.

**Persisting window titles.** Titles of other applications' windows are client names,
medical records, opposing counsel filenames. They may be displayed live; they must never
be written to disk, sent to the API, or logged.

---

## 8. Before you ship

```text
□ Does it still work in a plain browser?  (pnpm dev, no Tauri)
□ Is every id validated?
□ Registered in generate_handler!?
□ Does the window label match capabilities/default.json?
□ Errors returned as stable codes, not raw Rust errors?
□ Event listeners return a working unsubscribe?
□ cargo check passes?
□ No case/auth/API logic in lib.rs?
```

The first line is the one that gets missed. The browser build is not a fallback nobody
uses — it's how the app is used.
