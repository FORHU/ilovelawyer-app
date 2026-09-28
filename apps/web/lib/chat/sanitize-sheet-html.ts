import DOMPurify from "dompurify"

/**
 * Makes xlsx-preview's HTML safe to put on the page.
 *
 * xlsx-preview builds each sheet by pasting workbook content straight into HTML strings, escaping
 * nothing (xlsx-preview 1.0.5, src/htmls/genText.ts and genCell.ts): a hyperlink cell's address
 * goes into `href="…"` raw, rich text and formula results go in as markup, and a font name goes
 * into a `style` attribute. So an uploaded workbook can carry `<img onerror=…>` or a
 * `javascript:` link and run script in the viewer's session — and in the desktop app, script on
 * the page can also call the shell's commands, including reading the title of the other app's
 * window the user was last in (see lib/desktop's DockTarget).
 *
 * DOMPurify removes scripts, event handlers and `javascript:` URLs. On top of that:
 * - Links keep `target="_blank"` (xlsx-preview's own choice) but always get
 *   `rel="noopener noreferrer"`, so the opened page can't reach back into this one.
 * - Images must be inline `data:image/` — xlsx-preview only ever embeds images that way, so an
 *   external `src` can only have come from crafted content, as a "this was opened" beacon.
 * - A `style` attribute using `url(…)` is dropped for the same reason: xlsx-preview never
 *   writes one, but a crafted font name can smuggle one in (`font-family: x;background:url(…)`).
 *
 * Browser-only: DOMPurify needs a DOM. Call it from effects/event handlers, not during SSR.
 */
export function sanitizeSheetHtml(html: string): string {
  const purify = DOMPurify(window)
  purify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.hasAttribute("href")) {
      node.setAttribute("rel", "noopener noreferrer")
    }
    if (node.tagName === "IMG" && !(node.getAttribute("src") ?? "").startsWith("data:image/")) {
      node.remove()
      return
    }
    if (/url\s*\(/i.test(node.getAttribute("style") ?? "")) {
      node.removeAttribute("style")
    }
  })
  // `<style>` blocks are kept: xlsx-preview ends each sheet with them (column widths, borders),
  // built from numbers and its own class names — never from workbook text. FORCE_BODY stops
  // DOMPurify dropping a `<style>` that happens to come first in the string.
  return purify.sanitize(html, { ADD_ATTR: ["target"], FORCE_BODY: true })
}
