# I Love Lawyer — Desktop Implementation Plan

> **Target:** Browser + Windows Desktop
> **Frontend:** Next.js 16 / React 19 (`ilovelawyer-app`)
> **Desktop Runtime:** Tauri 2 / Rust, inside `ilovelawyer-app`
> **Backend:** `ilovelawyer-api`
> **Status:** Decisions settled, implementation not started
> **Last revised:** 2026-09-25

---

# 0. The Core Rule

> **Next.js owns what I Love Lawyer *is*. Rust owns what Windows *can do*.**
>
> **Window Intelligence is the primary native capability. Case association and panel
> automation are consumers of it, not its foundation.**

Everything below follows from this. When a decision is unclear, resolve it against this rule.

---

# 1. What We Are Actually Building

The desktop differentiator is **awareness of other applications** — not multiple windows.
Multiple windows already work.

```text
User works in another Windows application
        ↓
Window appears / moves / gains focus
        ↓
Rust detects it
        ↓
I Love Lawyer identifies what it represents
        ↓
Panel opens / moves / focuses
        ↓
Panel stays associated with that window
```

This is the one capability a browser fundamentally cannot provide. It is the reason
Tauri and Rust exist in this architecture.

---

# 2. Current State — Honest Inventory

Before planning work, know what already exists.

**Built and working** (`ilovelawyer-desktop/src-tauri/src/lib.rs`, ~508 lines):

```text
Main window creation
Case Terminal windows      (one per case, deduplicated by label)
Panel pop-out windows      (owned, cascading, close with owner)
Focus / position / close
Monitor selection          (via Tauri's available_monitors)
Next.js standalone sidecar (node.exe on :3002)
Health check / startup gating
```

**Built and working** (`ilovelawyer-app/apps/web/lib/desktop/index.ts`, ~126 lines):

```text
isDesktop() detection
openCaseTerminal / openPanelWindow
onPanelWindowClosed
Real browser fallbacks     (popups + close polling)
```

**Not built at all — 0% :**

```text
Any Win32 code
External window detection
Window tracking
Window identity
Window association
Rule matching
```

The native layer currently manages *its own* windows only. It has never looked at the
rest of the desktop. That is the entire gap.

**Do not rebuild what exists.** The panel system becomes the *consumer* of Window
Intelligence:

```text
Existing Tauri panel system
             ▲
             │
     Window Intelligence   ← the new work
             ▲
             │
        Win32 events
```

---

# 3. Repository

Single repo. `src-tauri/` lives inside `ilovelawyer-app`.

```text
ilovelawyer-app/
├── apps/web/            Next.js application
│   └── lib/desktop/     the bridge (already exists)
├── packages/
└── src-tauri/           ← moved here from ilovelawyer-desktop
```

`ilovelawyer-desktop` is **retired**. Its Rust is ported, not maintained in parallel.
`ilovelawyer-api` is unaffected — nothing in this plan changes the backend.

Unchanged boundaries: authentication stays in Next.js/API, application data still flows
through the API client, and Rust holds no business logic and no credentials.

---

# 4. Decision — Win32 Event Architecture

Initial discovery by enumeration, live updates by hook.

```text
Startup                          Live
  EnumWindows()                    SetWinEventHook()
       ↓                                ↓
  initial snapshot                 filtered events
       └────────────┬───────────────────┘
                    ↓
              Window state
```

**Events used:**

| Event | Purpose |
|---|---|
| `EVENT_SYSTEM_FOREGROUND` | user switched to a window |
| `EVENT_OBJECT_SHOW` | window became visible |
| `EVENT_OBJECT_HIDE` | window hidden without being destroyed |
| `EVENT_OBJECT_DESTROY` | window gone |
| `EVENT_SYSTEM_MINIMIZESTART` / `MINIMIZEEND` | minimize / restore |
| `EVENT_OBJECT_LOCATIONCHANGE` | moved / resized |

**Events deliberately not used:**

- `EVENT_OBJECT_FOCUS` — fires on focus moving *between controls inside* a window
  (every Tab keypress in a form). `EVENT_SYSTEM_FOREGROUND` is the correct event for
  "user switched apps."
- `EVENT_OBJECT_CREATE` — fires before the window has a title or is visible; many apps
  set the title asynchronously. Classify on `SHOW` instead.
- `EVENT_OBJECT_NAMECHANGE` — title tracking is out of scope (see §8).

**Threading.** `SetWinEventHook` delivers callbacks to the thread that registered it,
and that thread must run a Win32 message pump. Use a dedicated OS thread with its own
`GetMessage` loop, forwarding over a channel into async land.

**Never register the hook on the Tauri UI thread** — callbacks would run on the render
thread.

**Filtering,** in order, cheapest first:

```text
idObject == OBJID_WINDOW && idChild == CHILDID_SELF
        ↓
top-level window?
        ↓
relevant process?
        ↓
relevant event?
        ↓
coalesce
        ↓
emit
```

**Coalescing** emits **leading edge, then settles** — emit immediately, suppress the
burst, emit a final position when movement stops. Pure trailing debounce makes a dragged
panel feel dead for the whole drag.

**Instrument the coalescer from day one** — raw-in / emitted-out counters and a
development kill switch. The first thing you will learn is whether the filter is
adequate, and you cannot learn it without numbers.

**Liveness.** If the hook thread dies or stops pumping, detection stops permanently and
silently — the app looks fine and the feature is simply gone. Add a heartbeat and expose
a degraded state (`windowIntelligence: "active" | "unavailable"`) the UI can show. Cheap
now, awful to retrofit.

---

# 5. Decision — Window Identity

**HWND and PID are runtime handles, never identity.** Windows recycles handles;
processes restart.

```text
Runtime handle            What the window is
  hwnd                      process_path
  pid                       window_class
                            (+ heuristics)
```

**Accept the limitation honestly:** external windows are not durably identifiable.
`process_path` + `window_class` identifies *Chrome*, not *which Chrome window*. The only
thing distinguishing one Chrome window from another is its title or URL — which is
exactly the privileged data §8 forbids retaining.

Therefore:

- Associations are **in-memory and session-scoped**. They die with the process.
- Re-attachment after a restart is **user-confirmed**, never automatic.
- No persisted `HWND → client → case` relationships.

Auto-restoring associations across restarts is the feature that would force persisting
client-identifying strings. We are choosing not to.

`QueryFullProcessImageName` can fail with `ACCESS_DENIED` against elevated or protected
processes. Use `PROCESS_QUERY_LIMITED_INFORMATION` and degrade gracefully — HWND and
class are still available.

---

# 6. Decision — Monitor Identity

**Win32 is the source of truth for monitor identity and geometry.** Tauri's monitor list
is placement-only.

`szDevice` (`\\.\DISPLAY1`) looks stable and is not — it is an adapter-output index that
reshuffles when monitors are unplugged and replugged. Use the device interface path from
`EnumDisplayDevices` with `EDD_GET_DEVICE_INTERFACE_NAME`, or `QueryDisplayConfig`.

Keep identity and geometry separate:

```text
Which physical display is this?   ← stable identity
Where is it currently located?    ← geometry, changes freely
What is its scale factor?         ← changes freely
```

Note: Tauri does not expose `HMONITOR`, so joining its monitor list to the Win32 one
requires comparing position+size — the same fragile comparison in the current
`same_monitor()`. Prefer doing monitor work entirely in Win32 and converting only
coordinates.

---

# 7. Decision — The DPI Contract

Per-monitor DPI awareness v2. **Verify what tao already configures before touching the
manifest** — do not set it twice or fight it.

> Win32 owns physical coordinates. Tauri and Next.js own logical coordinates.
> Conversion happens at the native boundary, exactly once.

```text
Win32  (physical px)
   ↓
resolve the window's monitor   ← MonitorFromWindow, greatest overlap
   ↓
that monitor's scale factor
   ↓
convert once
   ↓
Tauri / Next.js  (logical px)
```

**The scale factor is per-window, not global.** A window straddling a 150% and a 100%
display has no single correct scale; use the monitor with greatest overlap. This
resolution step is exactly where mixed-DPI bugs live, which is why it is a contract and
not a test case.

Never round-trip physical → logical → physical → logical.

---

# 8. Decision — Privacy

**This is a legal application.** Window enumeration reads every application on the
user's desktop. Window titles leak client names, medical records, opposing counsel
filenames, personal email subjects.

**The rule:**

> External window titles are **never persisted, never sent to the API, never logged.**
> They *may* cross into the renderer for live display.

Display is not disclosure — the user is already looking at that window on their own
screen. Persistence and transmission are the actual risks, so those are what we forbid.

**Enforcement point matters.** Once a title is in React state it is one `console.error`,
error boundary, or future Sentry integration away from leaving the machine. Keep titles
out of anything passed to error reporting and out of any store that serializes.

**Logging.** Log runtime identifiers, never content:

```text
✓  [desktop.window] detected window_id=runtime:7f91 process=chrome.exe event=created
✗  [desktop.window] detected HWND=1234 title="John Smith Medical Records - Chrome"
```

**If automatic matching is added later,** the title never leaves Rust:

```text
Next.js  ──  opaque rule pattern  ──▶  Rust
                                        │
                                   local match
                                        │
Next.js  ◀──  "RULE_42_MATCHED"  ───────┘
```

Rust performs *matching*; Next.js owns what the rule *means*. This preserves both the
privacy rule and "no business logic in Rust."

---

# 9. Decision — The Bridge

The bridge represents **what I Love Lawyer can do with desktop windows** — not what
Win32 happens to expose.

```typescript
interface DesktopWindow {
  runtimeId: string        // opaque; the only handle the frontend uses
  processName: string
  windowClass?: string
  title?: string           // display only — see §8
  monitorId: string
  bounds: { x: number; y: number; width: number; height: number }
}
```

**No `hwnd` field.** Next.js has no Win32 access and every operation routes back through
Rust anyway. Omitting it enforces §5's identity decision at the type level instead of by
discipline.

**Keep the existing browser fallbacks.** The bridge is a capability abstraction, not a
Tauri detector:

```text
Browser  →  real browser behavior where it exists   (popups, polling)
            native capability = false where it doesn't

not:     →  everything unsupported
```

The current `lib/desktop/index.ts` already does this correctly. Extend it; do not replace
it with `isAvailable: () => false` stubs.

---

# 10. Build Sequence

The previous version of this plan was 11 sequential phases with payoff at phase 8. That
ordering builds coalescing, tracking and DPI normalization as solutions to problems not
yet observed. This sequence observes first.

```text
1. Migrate Tauri into ilovelawyer-app
        ↓
2. Verify the unified repo
        ↓
3. Window Intelligence tracer bullet
        ↓
4. Connect to the EXISTING panel system
        ↓
5. Extract the minimal bridge
        ↓
6. Expand only on observed need
```

## Step 1 — Migrate

Move `ilovelawyer-desktop/src-tauri` → `ilovelawyer-app/src-tauri`. Build no new
abstractions during this step. Own branch.

## Step 2 — Verify

```text
Next.js still runs
Tauri launches
Existing panels still work
Existing browser behavior still works
Rust builds
pnpm tauri dev works from ilovelawyer-app
```

**Packaging is explicitly out of scope here.** The bundled sidecar path
(`bundle.externalBin`, the `web-standalone` resource dir, `node.exe` on :3002) was never
verified even in the old repo, and moving `src-tauri` invalidates every one of those
relative paths at once. `tauri dev` skips the sidecar entirely. Revisit packaging after
the tracer bullet — otherwise a half-day migration becomes a week of bundling before a
line of Win32 exists.

## Step 3 — Tracer Bullet

The thinnest end-to-end slice. Roughly 300 lines.

```text
EnumWindows once
   + EVENT_SYSTEM_FOREGROUND only
   + hardcoded: process == chrome.exe
   + minimal DPI conversion
        ↓
   Tauri event
        ↓
   Next.js displays the detected window
```

No tracker. No coalescer. No rule engine. No association. No `LOCATIONCHANGE`.

**Minimal DPI conversion is included, not deferred** — see the trap in §11.

## Step 4 — Connect the Existing Panel

```text
Chrome becomes foreground
        ↓
Rust detects it
        ↓
Tauri emits
        ↓
Next.js receives
        ↓
Existing panel opens
        ↓
Positioned beside Chrome
```

If this works, the architecture is proven end to end.

## Step 5 — Extract the Bridge

Only now, with real events in hand, shape the abstraction in §9.

## Step 6 — Expand on Observed Need

In this order, each justified by something you watched happen:

```text
DESTROY                ← immediately; see §11
SHOW / HIDE
MINIMIZE / RESTORE
LOCATIONCHANGE
coalescing             ← when you watch a drag flood
window tracker         ← when you know what state you need
monitor/DPI framework  ← when positioning breaks on a real setup
manual association
settings
automatic rules
```

---

# 11. Known Traps

Five things that will cost real time if unaddressed.

**Packaging during migration.** See §10 step 2. Defer it.

**DPI is not deferrable past the tracer.** Step 4's success criterion *is* positioning.
`GetWindowRect` returns physical pixels; Tauri's `.position()` takes logical. Identical
at 100%, wrong everywhere else — so on a scaled display the tracer fails for reasons
unrelated to the architecture being tested. You need the conversion
(`MonitorFromWindow` → `GetDpiForWindow` → divide), not the framework. Ten lines.

**Focus feedback loop.** You react to `EVENT_SYSTEM_FOREGROUND` by opening a window —
which makes *that* window foreground, firing the event again. Ignore foreground events
for your own HWNDs, and show the panel **without activating it**
(`show_without_activation` / `SW_SHOWNOACTIVATE`). Otherwise switching to Chrome yanks
focus away from Chrome.

**`DESTROY` comes second, not later.** The first visible bug after the tracer works:
Chrome closes, the panel stays open forever attached to a dead window. Worse-looking
than no feature at all.

**"Following" a dragged window is probably wrong.** Real-time following looks bad —
you are reacting to deliberately coalesced events and each reposition is another Win32
call with its own latency, so the panel visibly lags. **Reposition on settle**, not
during drag. Separately: decide whether the panel stays above the external window.
Always-on-top is the obvious implementation and is genuinely irritating in practice — do
not let it become a default by accident.

---

# 12. Deliberately Not Building Yet

```text
DesktopProvider
RuntimeCapabilities flags
The use* hook family
Generalized rule engine / matching DSL
Persistent associations
Multiple new panel types (Document / AI / Context windows)
Automatic case matching
Multi-application support
```

The architecture should *support* multiple windows. That is not a reason to build five
of them because a document lists five.

Each item above is shape without a consumer. Add them when something real needs them.

---

# 13. Errors, Logging, Security Surface

**Errors** cross the Tauri boundary as structured values, never raw Rust errors:

```typescript
type DesktopError =
  | "WINDOW_NOT_FOUND"
  | "WINDOW_CREATE_FAILED"
  | "WINDOW_POSITION_FAILED"
  | "MONITOR_NOT_FOUND"
  | "HOOK_UNAVAILABLE"
  | "UNSUPPORTED_PLATFORM"
  | "PERMISSION_DENIED"
```

**Logging** is split by domain — application logs in Next.js, native logs in Rust —
and native logs carry runtime identifiers only (§8).

**Command surface** stays minimal. Expose only what the product needs:

```text
Allowed:   get_monitors, get_windows, focus_window,
           create_panel, position_panel, close_panel

Never:     execute_shell_command, arbitrary powershell, read_any_file
```

The larger security consideration for this app is not command surface but **what
enumerated window metadata is allowed to become** — see §8.

---

# 14. Testing

**Rust unit tests:** window matching, position calculation, monitor selection, state
transitions, coalescing behavior, DPI conversion math.

**Next.js tests:** components, hooks, state, API clients, with the desktop bridge mocked.

**Manual Windows testing** — required, not optional, and the only way to validate most
of this:

```text
1 / 2 / 3 monitors
100% / 125% / 150% / 200% scaling, including mixed
Monitor disconnect / reconnect
Window maximized / restored / minimized
External window created / destroyed / moved / resized / focused
Panel already exists vs. doesn't
Application restart
Elevated / protected target processes
Hook failure and recovery
```

---

# 15. Definition of Done

Not "Rust can X." The capability list is a means; these are the outcomes.

**The tracer bullet is done when:**

1. Switching to Chrome opens an I Love Lawyer panel beside it, on the correct monitor, at
   the correct position, on a scaled display.
2. Closing Chrome closes or releases the panel.
3. The panel does not steal focus from Chrome.
4. Detection can be turned off, and its event volume can be observed.
5. When the hook fails, the app says so instead of silently doing nothing.

**The feature is done when:**

6. A user can attach an external window to a case and the panel follows that association
   for the session.
7. Living with it for several days feels *useful* rather than like something popping up
   at you — evaluated on a real machine, with real work, before generalizing.
8. No window title has been written to disk, sent to the API, or entered a log.
9. Browser mode is unchanged and unaware any of this exists.
10. Business logic remains in Next.js/API; Rust holds only OS concerns.

Item 7 is the real hypothesis. Everything before it is plumbing that makes it testable.

---

# 16. Final Architecture

```text
                 I LOVE LAWYER
                       │
          ┌────────────┴────────────┐
          │                         │
       Browser                  Windows
          │                         │
       Next.js                  Tauri 2
          │                         │
          │                    Rust / Win32
          │                         │
          │                 Window Intelligence
          │                         │
          │                   External Windows
          │                         │
          └────────────┬────────────┘
                       │
                    Next.js
                       │
                Existing Panels
                       │
                ilovelawyer-api
```

The Rust layer is a **native capability and window-intelligence layer** — not a second
frontend and not a second backend.
