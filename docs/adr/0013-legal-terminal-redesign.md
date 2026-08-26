# Legal Terminal redesign: brand-consistent reskin, sidebar controls, drag-to-add, and new Display Preferences

Status: accepted

A reference design (dark, monospace-heavy, "terminal readout" aesthetic, brought in from outside this codebase) prompted a redesign of Legal Terminal. Rather than adopting it wholesale — which would mean a fixed-grid onboarding wizard and rebuilding the interaction model, the way Case Workspace replicated its own reference design in full (`docs/adr/0012-case-workspace-parallel-route.md`) — this is an in-place reskin: all 18 Panes, the freeform drag/resize model, Presets, and Terminal Workspace save/load stay exactly as they work today. The visual language stays anchored to this app's existing brand (gold accent, navy background, serif case-name heading) rather than the reference's cyan/green neon palette, and deliberately does not add fabricated telemetry-style stat chips (e.g. "LATENCY 14ms", "ENCRYPTION AES-256") — inventing metrics like that would conflict with this app's existing zero-hallucination stance (see Case Reconstruction's qualitative gaps list, not a fabricated coverage percentage, in `CONTEXT.md`).

Three pieces of real new functionality ship alongside the reskin, each decided over a simpler alternative:

- **Workspace Settings sidebar**: top-bar controls (Preset, add/remove Pane, Terminal Workspace save/load/reset) move into a new collapsible left sidebar, replacing the dropdown row. Chosen over restyling the top bar in place — a bigger structural change than a pure reskin, giving chrome a larger share of screen space.
- **Panel Library drag-and-drop**: the sidebar's Panel Library adds a Pane by dragging it onto the canvas and dropping at a specific position, rather than reusing the existing click-to-add pattern (today's "Add pane" dropdown → `cascadeRect` placement). This needs a new pointer-based DnD system.
- **Display Preferences** (High Density Mode, Grid Snapping, Panel Labels) are real, working toggles, not just relocated visuals:
  - High Density Mode tightens spacing/typography across both the chrome and every one of the 18 Pane bodies in `terminal-panels.tsx` — not chrome alone.
  - Grid Snapping changes the actual drag/resize math (`clampResize`, `onHeaderPointerMove`) so Panes snap to grid increments — not a cosmetic grid overlay.
  - Panel Labels, when off, hides a Pane's entire header bar (grip handle and close control included), revealed only on hover — so moving or closing a Pane requires hovering it first once this is off. Feature-detected via `(hover: hover)`: touch devices, which have no hover state, always show the header regardless of this toggle.

  All three persist globally per-browser via `localStorage`, matching the existing Language Preference pattern (`CONTEXT.md`) — not saved per Terminal Workspace, so they hold steady regardless of which saved workspace is loaded.

## Consequences

This is substantially more than a CSS pass: it touches the existing drag/resize interaction logic, adds a new DnD system for the Panel Library, and requires a spacing/typography pass across every Pane body.
