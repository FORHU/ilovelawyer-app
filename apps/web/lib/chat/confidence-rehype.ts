// Confidence view's shading, as a rehype plugin for ReactMarkdown.
//
// The chat-wonder demo (testers/confidence-render.js) shades the DOM *after* rendering with
// Range.extractContents(). That can't be ported to React: ReactMarkdown owns that DOM, and
// mutating it gets clobbered (or crashes) on the next render. This does the same job one step
// earlier, on the HAST tree ReactMarkdown is about to render, so React renders the <mark>s itself.
//
// Rules carried over from the demo, each learned from a real bug:
//  - Spans are matched against a BLOCK's text across its inline elements (<strong>, <em>, <code>)
//    — a sentence with bold in it lives in several text nodes, so a per-node search misses it.
//  - A block's "own text" stops at nested blocks (a tight <li> holding a nested <ul>) and at <a>:
//    links are never wrapped (citation links are styled by href instead), and chat-wonder removes
//    markdown links from the sentence it sends, so excluding link text here is what makes the prose
//    around a link match.
//  - Wrapping is per text node, so a sentence crossing <strong> becomes several <mark>s and never
//    splits an element.
//  - Longest quotes first, each claiming its range, so a short sentence can't steal part of a
//    longer one. Fail closed: a quote that doesn't match is simply left unshaded.

import { CONFIDENCE_TIERS, type ConfidenceSpan } from "./confidence"

// Minimal HAST shapes (the full `hast` types aren't a direct dependency of this app).
interface HastText {
  type: "text"
  value: string
}
interface HastElement {
  type: "element"
  tagName: string
  properties?: Record<string, unknown>
  children: HastNode[]
}
interface HastOther {
  type: string
  children?: HastNode[]
}
type HastNode = HastText | HastElement | HastOther
interface HastParent {
  children: HastNode[]
}

export interface ConfidenceRehypeOptions {
  spans: readonly ConfidenceSpan[]
  /** Builds the DOM id for a span's first <mark> from its index in `spans` — omit for no ids. */
  idFor?: (spanIndex: number) => string
}

const BLOCK_TAGS = new Set(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "td", "th", "dt", "dd"])
// Never descend into these when collecting a block's text.
const OPAQUE_TAGS = new Set(["a", "pre", "code", "svg", "mark"])

interface Segment {
  node: HastText
  parent: HastParent
}

interface Block {
  segments: Segment[]
  /** Whitespace-collapsed text of the block, and for each of its characters the segment index and
   * offset into that segment's value it came from. */
  text: string
  map: Array<{ seg: number; off: number }>
  claimed: Array<[number, number]>
}

interface Claim {
  start: number
  end: number
  spanIndex: number
}

function isElement(n: HastNode): n is HastElement {
  return n.type === "element"
}

function collectSegments(el: HastElement, out: Segment[]) {
  for (const child of el.children) {
    if (child.type === "text") out.push({ node: child as HastText, parent: el })
    else if (isElement(child)) {
      if (BLOCK_TAGS.has(child.tagName) || child.tagName === "ul" || child.tagName === "ol" || child.tagName === "blockquote") continue
      if (OPAQUE_TAGS.has(child.tagName)) continue
      collectSegments(child, out)
    }
  }
}

function buildBlock(segments: Segment[]): Block {
  let text = ""
  const map: Block["map"] = []
  let pendingSpace = false
  segments.forEach((seg, si) => {
    const v = seg.node.value
    for (let i = 0; i < v.length; i++) {
      const ch = v[i]!
      if (/\s/.test(ch)) {
        if (text.length > 0) pendingSpace = true
        continue
      }
      if (pendingSpace) {
        // The collapsed space maps to the character right before this one; it is only ever
        // inside a match (never at its edges, since quotes are trimmed), so either side works.
        map.push({ seg: si, off: i })
        text += " "
        pendingSpace = false
      }
      map.push({ seg: si, off: i })
      text += ch
    }
  })
  return { segments, text, map, claimed: [] }
}

function collectBlocks(node: HastNode, out: Block[]) {
  if (!("children" in node) || !node.children) return
  for (const child of node.children) {
    if (!isElement(child)) continue
    if (OPAQUE_TAGS.has(child.tagName) && child.tagName !== "a") continue
    if (BLOCK_TAGS.has(child.tagName)) {
      const segments: Segment[] = []
      collectSegments(child, segments)
      if (segments.length) out.push(buildBlock(segments))
    }
    // Nested blocks (a <p> inside <li>, a nested list) are visited too, each owning only its own
    // text — so a container never swallows its children's sentences.
    collectBlocks(child, out)
  }
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim()

function overlaps(claimed: Array<[number, number]>, start: number, end: number) {
  return claimed.some(([s, e]) => start < e && end > s)
}

function findUnclaimed(block: Block, quote: string): number {
  let from = 0
  while (from <= block.text.length) {
    const idx = block.text.indexOf(quote, from)
    if (idx === -1) return -1
    if (!overlaps(block.claimed, idx, idx + quote.length)) return idx
    from = idx + 1
  }
  return -1
}

function markElement(text: string, span: ConfidenceSpan, id: string | undefined): HastElement {
  const properties: Record<string, unknown> = {
    className: ["conf-span"],
    dataTier: span.tier,
  }
  if (span.why) properties.title = span.why
  if (id) properties.id = id
  return { type: "element", tagName: "mark", properties, children: [{ type: "text", value: text }] }
}

/** Splits each claimed character range back onto the original text nodes, replacing every
 * affected text node with plain-text and <mark> pieces in place. */
function applyClaims(block: Block, claims: Claim[], spans: readonly ConfidenceSpan[], idFor?: (i: number) => string) {
  // Per segment: ranges in the segment's own offsets.
  const perSeg = new Map<number, Array<{ s: number; e: number; spanIndex: number; first: boolean }>>()
  for (const c of claims) {
    const first = block.map[c.start]!
    const last = block.map[c.end - 1]!
    for (let si = first.seg; si <= last.seg; si++) {
      const segLen = block.segments[si]!.node.value.length
      const s = si === first.seg ? first.off : 0
      const e = si === last.seg ? last.off + 1 : segLen
      if (e <= s) continue
      const list = perSeg.get(si) ?? []
      list.push({ s, e, spanIndex: c.spanIndex, first: si === first.seg })
      perSeg.set(si, list)
    }
  }
  perSeg.forEach((ranges, si) => {
    const { node, parent } = block.segments[si]!
    ranges.sort((a, b) => a.s - b.s)
    const pieces: HastNode[] = []
    let pos = 0
    for (const r of ranges) {
      if (r.s > pos) pieces.push({ type: "text", value: node.value.slice(pos, r.s) })
      const span = spans[r.spanIndex]!
      pieces.push(markElement(node.value.slice(r.s, r.e), span, r.first && idFor ? idFor(r.spanIndex) : undefined))
      pos = r.e
    }
    if (pos < node.value.length) pieces.push({ type: "text", value: node.value.slice(pos) })
    const at = parent.children.indexOf(node)
    if (at !== -1) parent.children.splice(at, 1, ...pieces)
  })
}

/** Pure transform, exported for tests: shades `tree` in place and returns how many provenance
 * spans matched. */
export function applyConfidenceToTree(tree: HastNode, options: ConfidenceRehypeOptions): number {
  const spans = options.spans
  const candidates = spans
    .map((span, spanIndex) => ({ span, spanIndex, quote: normalize(span.quote) }))
    .filter((c) => c.span.source !== "citation" && c.quote.length > 0 && CONFIDENCE_TIERS.includes(c.span.tier))
    .sort((a, b) => b.quote.length - a.quote.length)
  if (candidates.length === 0) return 0

  const blocks: Block[] = []
  collectBlocks(tree, blocks)
  if (blocks.length === 0) return 0

  const claimsByBlock = new Map<Block, Claim[]>()
  let matched = 0
  for (const c of candidates) {
    for (const block of blocks) {
      const idx = findUnclaimed(block, c.quote)
      if (idx === -1) continue
      block.claimed.push([idx, idx + c.quote.length])
      const list = claimsByBlock.get(block) ?? []
      list.push({ start: idx, end: idx + c.quote.length, spanIndex: c.spanIndex })
      claimsByBlock.set(block, list)
      matched++
      break
    }
  }
  claimsByBlock.forEach((claims, block) => applyClaims(block, claims, spans, options.idFor))
  return matched
}

/** rehype plugin: `rehypePlugins={[[rehypeConfidence, { spans, idFor }]]}`. */
export function rehypeConfidence(options: ConfidenceRehypeOptions) {
  return (tree: HastNode) => {
    applyConfidenceToTree(tree, options)
  }
}
