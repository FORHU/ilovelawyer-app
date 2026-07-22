# Navy-tokenized dark mode instead of ad hoc `dark:` classes

Dark mode needed to span ~15 homepage pages plus the global header/footer, but the navy brand palette (`#0b132b`, `#131a33`, `#1c2547`, `#ffe088`) was hardcoded as literal hex across ~26 files rather than defined as reusable tokens, and the shared shadcn tokens in `packages/ui/src/styles/globals.css` used a generic neutral-gray `.dark` scale unrelated to the brand.

We chose to define the navy family as CSS custom properties and retint `--background`/`--card`/`--secondary`/etc. in `.dark` to navy-derived values (rather than leaving them neutral gray, or leaving colors hardcoded and patching in `dark:` variants file-by-file). This costs more upfront — every page's light-only utility classes had to be swapped for the semantic tokens (`bg-background`, `text-foreground`, `border-border`, etc.) — but means dark mode is "on-brand" navy rather than generic gray, matches how the shadcn primitives in `packages/ui` already work, and keeps the palette as a single source of truth instead of scattered hex literals.

The header/hero sections, which were already permanently navy regardless of light/dark, were left visually unchanged — they reference the new brand tokens but don't vary by theme, since that navy styling was already the intended dark-on-light-page design.
