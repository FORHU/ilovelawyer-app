# Case Terminal — panel pop-out

**Scope:** the single-panel pop-out window feature inside the Case Terminal. Complements `frontend-architecture.md` (general frontend structure) and `feature-architecture.md` §6 (Terminal's product/data map), neither of which currently documents this mechanism. Paths are relative to `ilovelawyer-app/apps/web/`.

## 1. What it is

From inside a case's Terminal (`/homepage/terminal/[caseId]`, all panels together — Timeline, Evidence, Risks, Citations, etc. in one grid), the user can pop a **single panel** out into its own small OS-level window, separate from the main grid. This is unrelated to the planned Tauri multi-monitor feature (which opens whole Terminal workspaces per monitor) — this is a narrower, pre-existing, browser-native feature scoped to one panel at a time.

Not a browser tab: it's a sized popup window (`560×680`), opened via `window.open(url, name, "width=560,height=680")` — no `target="_blank"` involved.

## 2. Trigger and state changes (opener side)

`popOutPanel(id: PanelId)` — [legal-terminal.tsx:582-592](../ilovelawyer-app/apps/web/components/terminal/legal-terminal.tsx#L582-L592):

```ts
const popOutPanel = (id: PanelId) => {
  const win = window.open(
    `/homepage/terminal/${caseId}/panel/${id}`,
    `terminal-panel-${caseId}-${id}`,
    "width=560,height=680",
  )
  if (!win) return
  popupWindowsRef.current.set(id, win)
  setMaximizedId((cur) => (cur === id ? null : cur))
  setLayout((prev) => (prev ? { ...prev, panels: prev.panels.map((p) => (p.id === id ? { ...p, visible: false } : p)) } : prev))
}
```

On click, the opener (the main Terminal grid):

1. Opens the popup at a **deterministic window name** (`terminal-panel-${caseId}-${id}`) — clicking pop-out again for the same panel in the same case re-focuses the existing popup rather than spawning a duplicate; this is native `window.open` behavior, not custom code.
2. If the browser blocks the popup, `win` is `null` and the function silently returns — the panel stays visible in the grid, no error surfaced to the user. There is no fallback UX for this case today.
3. Tracks the returned `Window` handle in `popupWindowsRef` (`useRef<Map<PanelId, Window>>`, [line 304](../ilovelawyer-app/apps/web/components/terminal/legal-terminal.tsx#L304)) — a ref, not state, since nothing needs to re-render from tracking it.
4. Clears `maximizedId` if the popped-out panel was the maximized one (a panel can't be both maximized-in-grid and popped-out).
5. Sets that panel's `visible: false` in `layout.panels` — the same field `hidePanel` uses, so the panel disappears from the grid. Unlike `hidePanel`, this skips the exit animation (`paneAnimations.animatePaneOut`) — the panel just vanishes, since it's reappearing in a different window rather than being dismissed.

## 3. Detecting when the popup closes

A polling effect ([legal-terminal.tsx:308-316](../ilovelawyer-app/apps/web/components/terminal/legal-terminal.tsx#L308-L316)) runs every 500ms, checking every tracked popup's `.closed` property:

```ts
useEffect(() => {
  const interval = setInterval(() => {
    for (const [id, win] of popupWindowsRef.current) {
      if (!win.closed) continue
      popupWindowsRef.current.delete(id)
      setLayout((prev) => (prev ? { ...prev, panels: prev.panels.map((p) => (p.id === id ? { ...p, visible: true } : p)) } : prev))
    }
  }, 500)
  ...
}, [])
```

The code's own comment explains why polling: `win.closed` is *"the only reliable cross-window signal a popup gives its opener without any cooperation from the popped-out page itself"* — no `postMessage`/`BroadcastChannel` wiring exists or is needed on either side. When a popup closes, its panel's `visible` flips back to `true` and it reappears in the main grid automatically, on the next 500ms tick.

## 4. The pop-out page itself

Route: `app/(protected)/homepage/terminal/[caseId]/panel/[panelId]/page.tsx` — a **minimal, independent page**, not a variant of the main Terminal shell:

- No `PageShell`/`GlobalHeader`/sidebar — just a 40px title bar (`PANEL_TITLES[panelId]`) over the panel body, full height.
- Calls `useCaseSnapshotQuery(caseId)` itself — its own fetch, own loading/error/retry UI. This is a **separate browsing context** (separate JS realm, separate QueryClient instance — see `frontend-architecture.md` §5), so the popup does not share the opener's React Query cache; it independently authenticates (re-runs the same silent-refresh flow any new tab/window does) and re-fetches the case snapshot from scratch.
- Validates `panelId` against `PANEL_IDS`; an invalid id renders a `loadError` state instead of crashing.
- Renders `<TerminalPanelBody panelId={panelId} caseId={caseId} snapshot={snapshot.data} />` inside its own `<TerminalDisplayProvider>` — the **same body component** the main grid uses for that panel, so panel content/logic is not duplicated; only the surrounding chrome differs. `TerminalDisplayProvider` re-reads display prefs (`highDensity`, `panelLabels`) from localStorage independently, per `frontend-architecture.md` §4's note that these stores hand-roll their own sync rather than using Zustand's `persist`.
- Explicit code comment on the route: *"no cross-window sync with the opener, since a pane only ever renders in one place at a time (hidden in the main grid while its pop-out is open)"* — this is a deliberate design stance, not a gap to fix.

## 5. What this feature deliberately does not do

- No cross-window sync of panel state (layout, zoom, scroll position, in-progress edits) between the opener and the popup — each is independently fetched/rendered.
- No popup-blocked fallback UX — a blocked popup fails silently.
- No persistence of "this panel was popped out" across a reload — closing/reopening the main Terminal page starts with every panel back in the grid; `visible: false` lives only in the in-memory `layout` state for that session.
- No multi-panel pop-out — one popup per panel, one panel per popup; there's no route or mechanism for popping out an arbitrary subset of panels together.

## 6. Relationship to the Tauri multi-monitor plan

Worth stating explicitly since both features involve "opening a new window": they are unrelated and operate at different granularities.

| | Panel pop-out (this doc) | Tauri multi-monitor (see `tauri-desktop-shell-plan.md`) |
| --- | --- | --- |
| Unit opened | One panel | One full Terminal (all panels) |
| Mechanism | Browser `window.open` | Native Tauri `WebviewWindowBuilder` |
| Trigger | Manual, per-panel button click | Automatic, on app launch, one per detected monitor |
| Sizing | Fixed 560×680 | Sized/maximized to fill the monitor it's opened on |
| Cross-window sync | None (by design) | None (by design) — the same "independent browsing context" pattern this feature already established is exactly what the Tauri plan relies on working the same way |

The Tauri plan's design explicitly cites this feature's "no cross-window sync" precedent as justification for not building any sync mechanism for the new multi-monitor windows either — it's the same architectural choice applied one level up.
