// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { sanitizeSheetHtml } from "@/lib/chat/sanitize-sheet-html"

// Each payload is shaped like what xlsx-preview 1.0.5 actually emits for a crafted cell — it
// pastes cell content into these templates unescaped (src/htmls/genText.ts, genCell.ts).
describe("sanitizeSheetHtml — crafted workbook content", () => {
  it("strips markup injected through plain, rich-text or formula cell text", () => {
    const out = sanitizeSheetHtml(`<td><img src=x onerror="alert(1)"></td><td><span><script>alert(2)</script></span></td>`)
    expect(out).not.toMatch(/onerror|<script|alert/)
  })

  it("neutralises a javascript: hyperlink cell", () => {
    const out = sanitizeSheetHtml(`<td><a href="javascript:alert(1)" target="_blank">click</a></td>`)
    expect(out).not.toContain("javascript:")
    expect(out).toContain("click")
  })

  it("stops a hyperlink address breaking out of its href attribute", () => {
    const out = sanitizeSheetHtml(`<td><a href="x" onmouseover="alert(1)" target="_blank">link</a></td>`)
    expect(out).not.toContain("onmouseover")
  })

  it("drops an external image, which could only be a read beacon", () => {
    expect(sanitizeSheetHtml(`<img src="https://attacker.example/pixel.png">`)).not.toContain("<img")
  })

  it("drops a style attribute smuggling url() through a font name", () => {
    const out = sanitizeSheetHtml(
      `<table><tbody><tr><td style="font-family: x;background:url(https://attacker.example/p);">v</td></tr></tbody></table>`,
    )
    expect(out).not.toContain("url(")
    expect(out).toContain("<td>v</td>")
  })
})

describe("sanitizeSheetHtml — legitimate sheet output survives", () => {
  it("keeps the table, merged-cell spans, cell colours and the sheet's own style block", () => {
    const sheet =
      `<table class="table-u"><tbody class="tbody-u"><tr style="height:20px;">` +
      `<td colspan="2" rowspan="1" style="color: rgba(31,58,95,1);font-weight: bold;">Total</td>` +
      `</tr></tbody></table><style>.table-u { width: 640px; }</style>`
    const out = sanitizeSheetHtml(sheet)
    expect(out).toContain(`colspan="2"`)
    expect(out).toContain("rgba(31,58,95,1)")
    expect(out).toContain("<style>.table-u { width: 640px; }</style>")
  })

  it("keeps embedded images", () => {
    expect(sanitizeSheetHtml(`<img src="data:image/png;base64,iVBORw0KGgo=" style="left: 4px;">`)).toContain(
      "data:image/png;base64",
    )
  })

  it("keeps real links opening in a new tab, cut off from this page", () => {
    const out = sanitizeSheetHtml(`<a href="https://lawphil.net/" target="_blank">LawPhil</a>`)
    expect(out).toContain(`href="https://lawphil.net/"`)
    expect(out).toContain(`target="_blank"`)
    expect(out).toContain(`rel="noopener noreferrer"`)
  })
})
