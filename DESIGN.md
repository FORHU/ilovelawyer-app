# Design Reference

Source of truth: the Consultation page (`/homepage`) and Cases page (`/homepage/case-portfolio`). Every other page in the app is being migrated toward this system (see the global rollout plan). When in doubt, open those two pages' source and match what they do.

## Color

All tokens live in `packages/ui/src/styles/globals.css`. Never hardcode hex values in a component — use the Tailwind utilities below.

| Token | Utility | Default (`:root`) | `.landing-theme` |
|---|---|---|---|
| `--brand-navy-950` | `bg-brand-navy-950` | `#0b1220` (saturated navy) | `#0b0b0b` (near-black) |
| `--brand-navy-900` | `bg-brand-navy-900` | `#131c33` | `#1a1a1a` |
| `--brand-navy-800` | `bg-brand-navy-800` | `#1d2a47` | `#1a1a1a` |
| `--brand-gold` | `text-brand-gold` / `bg-brand-gold` | `#f6c445` | `#c9a44c` |
| `--brand-status-green` | `text-brand-status-green` | `#2e8b57` | same | 
| `--brand-oxblood` | `text-brand-oxblood` | `#5c1f28` | same |

`--brand-gold` is reserved for confirming/primary actions (CTAs, active-tab dots). `--brand-status-green` is only for verification/status badges (e.g. "Vetted" citations) — never reuse gold for status. `--brand-oxblood` is a sparing decorative accent (footer dividers only), not a second broad accent.

**`.landing-theme` is the redesign switch.** Any page wrapper that has this class gets the noir/gold palette; without it, the page (and the shared header, since it hardcodes `bg-brand-navy-950`) renders the old saturated-navy look. This is why `GlobalHeader` looked inconsistent across pages — the header itself never changed, only the ambient class did. Every page in this app should carry `.landing-theme` going forward; there is no reason for a page to opt out.

Dark mode (`.dark`) recolors `--background`/`--card`/etc. to the navy elevation scale. Combined with `.landing-theme`, `.dark .landing-theme` redeclares `--background`/`--card`/`--muted`/etc. directly to near-black — this is a deliberate workaround because Tailwind v4 resolves `var()` chains where `.dark` is applied (usually `<html>`), not lazily at the point of use, so `.landing-theme`'s override of `--brand-navy-*` alone can't reach `.dark`'s already-resolved `--background`. If you add a new `.dark`-aware token that should follow the landing palette, it needs the same direct redeclaration in `.dark .landing-theme`, not just a `--brand-navy-*` override.

Use `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border` for everything else — never a raw gray.

### Light mode is not an afterthought

**No page forces a theme.** Every page uses plain `.landing-theme` and respects the user's light/dark toggle (`ThemeToggle` in `GlobalHeader`, backed by `next-themes`). If you're tempted to hardcode `dark` on a page wrapper "because this page looks better dark," don't — fix the light-mode styling instead (see below), the way Consultation's forced-`dark` was removed once its light-mode bugs were fixed.

Light `.landing-theme` gets its own elevation tokens (`--card`/`--popover`/`--secondary`/`--accent`: `#fafaf8`/`#f2f1ec`), because plain `:root` has `--card` equal to `--background` (`#ffffff` both) — anything relying on `bg-card` for contrast (hover states, composer chips, modals) was invisible against a white page. This is the light-mode counterpart to `.dark .landing-theme`'s near-black/`#1a1a1a` pairing — same structure, light brightness.

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

## Layout

- Page wrapper: `<div className="landing-theme min-h-screen w-full ... bg-background text-foreground font-['Inter',sans-serif]">`, with `<GlobalHeader activeTab="..." />` as the first child. `GlobalHeader` is `absolute`-positioned, so the wrapper needs `relative` if content below it needs correct stacking.
- Main content: `<main className="max-w-[1280px] w-full mx-auto px-6 md:px-12 pt-24 pb-16 ...">` — `pt-24` clears the absolutely-positioned header.
- Section header pattern (title + CTA): flex row, `items-end justify-between gap-6 flex-wrap`, title block on the left (eyebrow dot + title + subtitle stacked), action button on the right.
- List rows: a single `div` that is `flex flex-col` on mobile and `md:grid md:grid-cols-[...]` on desktop — not two separate mobile/desktop markups. Row actions fade in on `group-hover` at `md:` and up, always-visible below `md:` (no hover on touch).
- Empty states: icon in a circular `bg-card` badge, Libre Caslon heading, muted-foreground body, one CTA. Never just a bare "No results" string.

## Navigation (`GlobalHeader`, `apps/web/components/global-header.tsx`)

This is the one global nav — every page renders it with an `activeTab` prop, there is no per-page header variant. Structure:
- Fixed `bg-brand-navy-950` bar, `absolute top-0 left-0 w-full`, logo left, centered nav links (desktop only, `lg:flex`), language/theme/account icons right, hamburger + slide-in drawer below `lg`.
- Active tab: bold + white + a small `bg-brand-gold` dot centered under the label (absolutely positioned so it never shifts label height).
- Inactive tab: `opacity-60 text-white hover:opacity-100`.
- `mobileHeaderMerged` prop: set when a page renders its own mobile title row and wants the header to suppress its own mobile border/hamburger (see `case-portfolio/[id]/page.tsx`).

If the header looks "wrong" (old navy blue instead of near-black/gold) on some page, the header component is not the bug — check whether that page's wrapper div has `.landing-theme`.

## Known gap

`docs/adr/0002` is cited throughout `global-header.tsx` and `globals.css` as the source of the navy/gold brand decision, but that ADR file doesn't exist in `docs/adr/` (only 0008-0013 are present). Worth reconstructing as a real ADR at some point — not blocking day-to-day use of this doc.
