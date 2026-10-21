/** The legal persona writes emphasis as markdown (`*BPY v MXV*`, `**section 34**`). Where the app
 * prints that text as plain text (the "How I got this" box), the marks would show, so the pairs are
 * dropped and the words kept. A lone `*` (a footnote mark, a multiplication sign) is left alone. */
export function plainEmphasis(text: string): string {
  return text.replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/\*([^*\n]+)\*/g, "$1");
}
