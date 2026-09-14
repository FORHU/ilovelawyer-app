# Design Reference

Source of truth: the Consultation page (`/homepage`) and Cases page (`/homepage/case-portfolio`). Every other page in the app is being migrated toward this system (see the global rollout plan). When in doubt, open those two pages' source and match what they do.

## Color

All tokens live in `packages/ui/src/styles/globals.css`. Never hardcode hex values in a component — use the Tailwind utilities below. There is one brand palette, defined once at `:root`/`.dark` — no page-level class needed to opt into it, and no saturated-navy fallback to accidentally fall back to.

| Token | Utility | Value |
|---|---|---|
| `--brand-navy-950` | `bg-brand-navy-950` | `#0b0b0b` (near-black) |
| `--brand-navy-900` | `bg-brand-navy-900` | `#1a1a1a` |
| `--brand-navy-800` | `bg-brand-navy-800` | `#1a1a1a` |
| `--brand-gold` | `text-brand-gold` / `bg-brand-gold` | `#c9a44c` |
| `--brand-status-green` | `text-brand-status-green` | `#2e8b57` |
| `--brand-oxblood` | `text-brand-oxblood` | `#5c1f28` |

`--brand-gold` is reserved for confirming/primary actions (CTAs, active-tab dots). `--brand-status-green` is only for verification/status badges (e.g. "Vetted" citations) — never reuse gold for status. `--brand-oxblood` is a sparing decorative accent (footer dividers only), not a second broad accent.

**There used to be two brand palettes** — a saturated-blue navy default and a near-black override that only applied under a `.landing-theme` class — and `GlobalHeader` (which hardcodes `bg-brand-navy-950`) looked inconsistent across pages purely based on whether the ambient wrapper happened to carry that class. The saturated-navy family has been retired; the near-black/gold look is simply the default now, everywhere, with nothing to opt into and nothing to forget.

Dark mode (`.dark`) recolors `--background`/`--card`/etc. to the near-black elevation scale via `var(--brand-navy-*)`. There's no second override layer to keep in sync anymore — if you add a new `.dark`-aware token, just declare it once in the `.dark` block like everything else there.

Use `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border` for everything else — never a raw gray.

### Light mode is not an afterthought

**No page forces a theme.** Every page respects the user's light/dark toggle (`ThemeToggle` in `GlobalHeader`, backed by `next-themes`). If you're tempted to hardcode `dark` on a page wrapper "because this page looks better dark," don't — fix the light-mode styling instead (see below), the way Consultation's forced-`dark` was removed once its light-mode bugs were fixed.

Light mode's `--card`/`--popover`/`--secondary`/`--accent` (`#fafaf8`/`#f2f1ec`) are distinct from `--background` (`#ffffff`) — plain white-on-white would make anything relying on `bg-card` for contrast (hover states, composer chips, modals) invisible against the page. This is the light-mode counterpart to `.dark`'s near-black/`#1a1a1a` pairing — same structure, light brightness.

**Never hardcode a dark-only color in a component.** The most common mistake: `text-white`, `border-white/20`, `bg-white/5` on an element that sits on a themed surface (`bg-background`, `bg-card`). These assume an always-dark canvas and go invisible (white-on-white) in light mode. Use the semantic token instead: `text-foreground`, `border-border`, `bg-foreground/5`, `text-muted-foreground`. The one exception is a deliberately dark "island" that's explicitly dark-styled regardless of page theme (the gold-gradient AI-CTA banners' `bg-gradient-to-br from-brand-navy-800 to-brand-navy-950 text-white`, modal/drawer backdrops like `bg-black/40`, or the mind-map canvas's self-contained dark surface) — those are fine as-is because their own background is also hardcoded, not themed.

A decorative image/gradient that fades into the page background must fade into `var(--background)` (e.g. Tailwind's `from-background`/`via-background/55`/`to-background/35` gradient utilities), never a hardcoded hex like `#0b0b0b` — otherwise it only looks right in the one mode it was designed against.

## Typography

- **Display/heading font:** `font-['Libre_Caslon_Text']`, always `font-light`, tight tracking (`tracking-[-0.02em]`). Used for page titles and empty-state headings only — never for body text or UI labels.
  - Scale: page title `text-[23px] sm:text-[clamp(34px,3.6vw,48px)]`. Empty-state heading `text-[clamp(30px,4vw,44px)]`. Modal/card heading `text-[22px]` or `text-sm` for small inline numerals (e.g. step markers "I / II / III").
- **Body font:** `font-['Inter',sans-serif]` (the app default — set this once on the page wrapper, not per element).
- **UI labels / nav / buttons / badges:** uppercase, heavily tracked, tiny: `text-[10px] tracking-[1px] uppercase font-semibold`. This is the one recurring "chrome" type style — nav tabs, CTA button labels, table headers, badges, pagination all use it. Don't invent a second label style.
- **Body copy:** `text-muted-foreground text-[13px] sm:text-[15px] leading-relaxed`, capped with `max-w-[...ch or px]` so paragraphs don't run full-width.

## Buttons

Base primitive: `@workspace/ui`'s `Button` (`packages/ui/src/components/button.tsx`, CVA-based). Add new variants there instead of hand-rolling a one-off button class.

- **Primary/confirming action (the gold pill):** `bg-brand-gold text-brand-navy-950 font-semibold text-[11px] tracking-[1.2px] uppercase px-6 h-[42px] rounded-full hover:opacity-85`. This is the one "accent" action per page — don't use gold for more than one competing CTA on a screen.
- **Secondary/outline pill:** `border border-border rounded-full h-9 px-4 text-[11px] font-semibold tracking-[1px] uppercase text-foreground hover:border-foreground/40`.
- **Icon-only round button:** `h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-background`.
- Every interactive control gets a `Tooltip`/`TooltipContent` wrapper (`@workspace/ui/components/tooltip`) with a short description — this is used consistently, not occasionally.
- Corner radius is always `rounded-full` for anything clickable (buttons, pills, search input, icon buttons). Cards/containers use `rounded-lg`/`rounded-2xl`. Don't mix a square button into this system.

## Forms

Use `@workspace/ui`'s `Input`/`TextField` (`packages/ui/src/components/input.tsx`) instead of hand-rolling a text field — `TextField` gives you the label-above/error-below layout for free; use bare `Input` only when you need a bespoke label layout (e.g. a repeating row where the label sits differently). Label above the input, helper text (if any) between label and input, error text below the input with the red-icon-plus-message pattern — never placeholder-as-label.

## Status / Badges

Use `@workspace/ui`'s `Badge` (`packages/ui/src/components/badge.tsx`) for any status/tag/pill element instead of hand-rolling one. It has two `shape`s: `rounded` (default — `font-mono`, tight tracking, for dense/terminal contexts) and `pill` (`rounded-full`, the shape used by the rest of the app, e.g. RAG status). Pick a `tone` (`neutral`/`success`/`warning`/`danger`) rather than reaching for a raw color utility.

## Layout

- Page wrapper: `<div className="min-h-screen w-full ... bg-background text-foreground font-['Inter',sans-serif]">`, with `<GlobalHeader activeTab="..." />` as the first child. `GlobalHeader` is `absolute`-positioned, so the wrapper needs `relative` if content below it needs correct stacking. Use the shared `PageShell` component (`apps/web/components/page-shell.tsx`) instead of hand-writing this.
- Main content: `<main className="max-w-[1280px] w-full mx-auto px-6 md:px-12 pt-24 pb-16 ...">` — `pt-24` clears the absolutely-positioned header.
- **Content width**: pick one of the three named tiers from `apps/web/lib/layout-constants.ts` (`CONTENT_WIDTH_SM` 1000px for legal/reference pages and forms, `CONTENT_WIDTH_MD` 1280px for case list/detail, `CONTENT_WIDTH_LG` 1440px for calendar/terminal/transcription/the header) instead of picking a new pixel value by eye.
- Section header pattern (title + CTA): flex row, `items-end justify-between gap-6 flex-wrap`, title block on the left (eyebrow dot + title + subtitle stacked), action button on the right.
- List rows: a single `div` that is `flex flex-col` on mobile and `md:grid md:grid-cols-[...]` on desktop — not two separate mobile/desktop markups. Row actions fade in on `group-hover` at `md:` and up, always-visible below `md:` (no hover on touch).
- Empty states: icon in a circular `bg-card` badge, Libre Caslon heading, muted-foreground body, one CTA. Never just a bare "No results" string.
- **Z-index**: pick from the documented scale in `globals.css` (`z-(--z-sidebar)` 40, `z-(--z-modal)` 50, `z-(--z-header-drawer)` 60, `z-(--z-canvas-overlay)` 9999 for controls layered above a self-contained canvas like mind-map) instead of a freehand number.

## Navigation (`GlobalHeader`, `apps/web/components/global-header.tsx`)

This is the one global nav — every page renders it with an `activeTab` prop, there is no per-page header variant. Structure:
- Fixed `bg-brand-navy-950` bar, `absolute top-0 left-0 w-full`, logo left, centered nav links (desktop only, `lg:flex`), language/theme/account icons right, hamburger + slide-in drawer below `lg`.
- Active tab: bold + white + a small `bg-brand-gold` dot centered under the label (absolutely positioned so it never shifts label height).
- Inactive tab: `opacity-60 text-white hover:opacity-100`.
- `mobileHeaderMerged` prop: set when a page renders its own mobile title row and wants the header to suppress its own mobile border/hamburger (see `case-portfolio/[id]/page.tsx`).

## Known gap

`docs/adr/0002` was cited in older comments in `global-header.tsx`/`globals.css` as the source of the navy/gold brand decision, but that ADR file doesn't exist in `docs/adr/` (only 0008-0013 are present) — worth reconstructing as a real ADR documenting the near-black/gold palette decision at some point.
