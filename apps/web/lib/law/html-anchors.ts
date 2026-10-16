const HTML_ANCHOR_RE = /<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi

/**
 * Chat Wonder sometimes cites controlling authorities as literal `<a href="...">text</a>` HTML
 * anchors (its legal-mode `format_legal_citation_links` turns `[label Law](url)` into
 * `<a href="url" class="legal-ref law" target="_blank">label Law</a>`) rather than markdown link
 * syntax. react-markdown doesn't render embedded raw HTML (by design, to avoid piping untrusted
 * LLM output straight into the DOM), so left alone these show up as literal tag text. Convert
 * them to markdown links instead of turning on raw HTML rendering. Shared by the chat transcript
 * (assistant-message.tsx) and the Terminal's attributed-markdown panes (Red Team, Case
 * Reconstruction), which receive the same Chat Wonder output.
 */
export function convertHtmlAnchors(content: string): string {
  return content.replace(HTML_ANCHOR_RE, "[$2]($1)")
}
