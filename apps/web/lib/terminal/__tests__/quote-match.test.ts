import { describe, it, expect } from "vitest"
import {
  MIN_QUOTE_CHARS,
  buildPageText,
  findQuote,
  itemSliceRect,
  itemsInRange,
  quoteAnchor,
  squash,
} from "../quote-match"

const PAGE =
  "BUNDLE DOCUMENT 13 OF 21 D13 / p.2\nThe NVR fault was closed and resolved on 3 November 2023, and the cameras were recording.\nInvoice 4471 was paid on 20 November 2023."

/** The page text a match covers. */
const matched = (page: string, quote: string, opts?: { approximate?: boolean }) => {
  const m = findQuote(page, quote, opts)
  return m ? page.slice(m.start, m.end) : null
}

describe("findQuote: found", () => {
  it("finds the quote exactly as written", () => {
    expect(matched(PAGE, "The NVR fault was closed and resolved on 3 November 2023")).toBe(
      "The NVR fault was closed and resolved on 3 November 2023",
    )
    expect(findQuote(PAGE, "The NVR fault was closed and resolved on 3 November 2023")?.approximate).toBe(false)
  })

  it("ignores case", () => {
    expect(matched(PAGE, "THE NVR FAULT WAS CLOSED")).toBe("The NVR fault was closed")
  })

  it("ignores extra spaces and line breaks in either text", () => {
    expect(matched("The NVR fault\nwas   closed and\nresolved on 3 November", "The NVR fault was closed and resolved")).toBe(
      "The NVR fault\nwas   closed and\nresolved",
    )
    expect(matched(PAGE, "cameras   were\n recording")).toBe("cameras were recording")
  })

  it("treats curly and straight quotes and dashes alike", () => {
    expect(matched("He said “the cameras weren’t recording” that night.", `"the cameras weren't recording"`)).toBe(
      "the cameras weren’t recording",
    )
    expect(matched("paid – in full – by cheque", "paid - in full - by cheque")).toBe("paid – in full – by cheque")
  })

  it("ignores ellipses at either end of the stored excerpt", () => {
    expect(matched(PAGE, "…the cameras were recording…")).toBe("the cameras were recording")
    expect(matched(PAGE, "...the cameras were recording...")).toBe("the cameras were recording")
  })

  it("anchors on the longest piece of a quote clipped in the middle", () => {
    expect(matched(PAGE, "The NVR … Invoice 4471 was paid on 20 November 2023")).toBe("Invoice 4471 was paid on 20 November 2023")
    expect(quoteAnchor("a b … a much longer second piece … c")).toBe("a much longer second piece")
  })

  it("matches a word broken by a hyphen at a line break", () => {
    expect(matched("the confiden-\ntial settlement was agreed", "the confidential settlement was agreed")).toBe(
      "the confiden-\ntial settlement was agreed",
    )
  })

  it("matches across a ligature and accents", () => {
    expect(matched("The oﬃce of the café owner", "The office of the cafe owner")).toBe("The oﬃce of the café owner")
  })

  it("matches a quote across text-item boundaries without spaces", () => {
    const { text } = buildPageText([{ str: "closed on 3" }, { str: "November" }, { str: "2023 by the" }, { str: "engineer" }])
    expect(matched(text, "closed on 3 November 2023 by the engineer")).toBe(text)
  })

  it("picks the first occurrence of a repeated passage", () => {
    const page = "Paid on 3 November 2023. Later: paid on 3 November 2023 again."
    expect(findQuote(page, "paid on 3 November 2023")?.start).toBe(0)
  })
})

describe("findQuote: OCR differences", () => {
  const QUOTE = "The NVR fault was closed and resolved on 3 November 2023"

  it("tolerates a few wrong characters", () => {
    const ocr = "The NVR fau1t was cl0sed and resolved on 3 Novernber 2023, and the cameras"
    const m = findQuote(ocr, QUOTE)
    expect(m?.approximate).toBe(true)
    expect(ocr.slice(m!.start, m!.end)).toContain("fau1t was cl0sed")
    expect(m!.start).toBe(0)
  })

  it("tolerates rn read as m and l read as 1", () => {
    const m = findQuote("as noted, the fault was c1osed and resolved on 3 Novernber 2023.", "the fault was closed and resolved on 3 November 2023")
    expect(m?.approximate).toBe(true)
  })

  it("tolerates a few extra or missing words' worth of characters", () => {
    expect(matched("The NVR fault closed and resolved on 3 November 2023", QUOTE)).not.toBeNull()
  })

  it("can be turned off, leaving only exact matches", () => {
    const ocr = "The NVR fau1t was cl0sed and resolved on 3 Novernber 2023"
    expect(findQuote(ocr, QUOTE, { approximate: false })).toBeNull()
  })
})

describe("findQuote: not found", () => {
  it("returns null for unrelated text", () => {
    expect(findQuote(PAGE, "The defendant denies all liability for the loss of the vehicle")).toBeNull()
  })

  it("returns null for text that only shares a few words", () => {
    expect(findQuote(PAGE, "The cameras were not recording on 14 November 2023 owing to the fault")).toBeNull()
  })

  it("returns null for a page with no text (a scan with no text layer)", () => {
    expect(findQuote("", QUOTE_LONG)).toBeNull()
    expect(findQuote("   \n ", QUOTE_LONG)).toBeNull()
  })

  it("rejects a quote too short to be trusted", () => {
    expect("the".length).toBeLessThan(MIN_QUOTE_CHARS)
    expect(findQuote(PAGE, "the")).toBeNull()
    expect(findQuote(PAGE, "14 Nov")).toBeNull()
    expect(findQuote(PAGE, "")).toBeNull()
    expect(findQuote(PAGE, "…")).toBeNull()
  })
})

const QUOTE_LONG = "The NVR fault was closed and resolved"

describe("squash", () => {
  it("keeps letters and digits and remembers where each came from", () => {
    const { text, map } = squash("A-b 1!")
    expect(text).toBe("ab1")
    expect(map).toEqual([0, 2, 4])
  })
})

describe("mapping a match back onto text items", () => {
  const items = [{ str: "The NVR fault " }, { str: "was closed", hasEOL: true }, { str: "and resolved" }]
  const { text, spans } = buildPageText(items)

  it("lays items out in order, with a line break after an end-of-line item", () => {
    expect(text).toBe("The NVR fault was closed\nand resolved")
    expect(spans).toEqual([
      { start: 0, end: 14 },
      { start: 14, end: 24 },
      { start: 25, end: 37 },
    ])
  })

  it("lists each item the match touches with the characters of it inside the match", () => {
    const m = findQuote(text, "fault was closed and")!
    expect(itemsInRange(spans, m.start, m.end)).toEqual([
      { index: 0, from: 8, to: 14 },
      { index: 1, from: 0, to: 10 },
      { index: 2, from: 0, to: 3 },
    ])
  })

  it("lists nothing for an empty range", () => {
    expect(itemsInRange(spans, 5, 5)).toEqual([])
  })
})

describe("itemSliceRect", () => {
  const item = { str: "abcdefghij", width: 100, height: 10, transform: [10, 0, 0, 10, 50, 700] }

  it("takes the slice of the item's width the characters cover", () => {
    expect(itemSliceRect(item, 0, 10)).toEqual([50, 698, 150, 710])
    expect(itemSliceRect(item, 2, 5)).toEqual([70, 698, 100, 710])
  })

  it("has no rectangle for an empty item or empty slice", () => {
    expect(itemSliceRect({ ...item, str: "" }, 0, 1)).toBeNull()
    expect(itemSliceRect(item, 4, 4)).toBeNull()
  })

  it("falls back to the font size when the item reports no height", () => {
    expect(itemSliceRect({ ...item, height: 0 }, 0, 10)).toEqual([50, 698, 150, 710])
  })
})
