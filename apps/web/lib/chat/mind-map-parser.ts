// Client-side mirror of ilovelawyer-api's src/utils/response-parser.ts, itself ported from
// law-ph's lib/citation-parser.ts. The API only strips/persists the [MINDMAP]...[/MINDMAP]
// block from the *final* response — the raw stream handed to onChunk in sendChatMessage still
// contains it, so the frontend needs its own extractor/stripper to keep it out of the live
// streaming bubble and to read the tree out as it arrives.

// Mirrors ilovelawyer-api's MindMapItem. Maps the API saves are already normalized there
// (normalizeMindMap in src/utils/response-parser.ts): ids are path-based and stable across
// regenerations — `root`, the fixed branches `legalBasis` / `keyFacts` / `remedies` / `risks` /
// `nextSteps`, other first-level nodes `b<n>`, deeper nodes `<parent id>.<n>` — and the tree is
// kept inside MIND_MAP_LIMITS. Maps saved before that carry the model's own ids and none of the
// optional fields below, so nothing here may assume they're present.
export interface MindMapItem {
  id: string;
  label: string;
  description?: string;
  isRoot?: boolean;
  /** Levels below the root; the root is 0. */
  depth?: number;
  /** More exists (or could be generated) below this node than the tree carries. */
  hasMore?: boolean;
  /** The model's own id, kept only when it differs from the path id. */
  sourceId?: string;
  media?: unknown[];
  /** Case documents this point comes from (the case's document-built map only). */
  sources?: { documentId: string; page?: number }[];
  /** What Jev found checking this point against its cited passage — see MindMapNodeCheck. */
  check?: MindMapNodeCheck;
  /** A document this point cited was removed or archived and the map wasn't rebuilt. */
  sourceRemoved?: boolean;
  children: MindMapItem[];
}

/** Mirrors ilovelawyer-api's MindMapNodeCheck (mind-map-jev.ts). Absent until checked, and gone
 * again once the node's text is edited. */
export interface MindMapNodeCheck {
  verdict: "SUPPORTED" | "UNSUPPORTED" | "CONTRADICTED";
  confidence: number;
  /** "ASSERTED_BY_PARTY" | "STATED_BY_WITNESS" | "SHOWN_BY_DOCUMENT" | "ESTABLISHED" */
  evidenceKind: string;
  documentId: string;
  page?: number;
  /** False when judged on the document's most relevant passages because no page was cited (or
   * the page had no text) — weaker evidence. */
  located: boolean;
  checkedAt: string;
}

function isMindMapShape(v: unknown): v is MindMapItem {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const anyV: any = v;
  return Boolean(anyV.id || anyV.nodes || anyV.label || anyV.children);
}

function branchList(item: unknown): unknown[] {
  if (!item || typeof item !== "object") return [];
  const anyItem = item as Record<string, unknown>;
  const kids =
    anyItem.children ?? anyItem.items ?? anyItem.nodes ?? anyItem.subnodes ?? anyItem.branches ?? anyItem.subitems;
  return Array.isArray(kids) ? kids : [];
}

/** Unwraps Chat Wonder wrappers (`mindMap`, `root`) down to a renderable tree. */
export function normalizeMindMap(v: unknown): MindMapItem | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const anyV: any = v;
  const nested = anyV.mindMap ?? anyV.mindmap ?? anyV.mind_map;
  const tree =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? nested
      : anyV.root && typeof anyV.root === "object" && !Array.isArray(anyV.root) &&
          (anyV.root.label || anyV.root.id || anyV.root.children)
        ? anyV.root
        : anyV;
  if (!isMindMapShape(tree)) return undefined;
  return tree as MindMapItem;
}

/** True when the tree has at least one child branch (the map tab's render gate). */
export function usableMindMap(v: unknown): MindMapItem | undefined {
  const tree = normalizeMindMap(v);
  if (!tree) return undefined;
  return branchList(tree).length > 0 ? tree : undefined;
}

/** The mind map is a living document for the whole consultation, not any one message — this
 * walks the transcript back-to-front and surfaces the most recent one the AI actually
 * populated. Shared by ConsultationChat's own Mind Map tab and the Case Workspace Studio
 * panel's Mind Map modal, so both derive the "current" map identically. */
export function getActiveMindMap(messages: { mindMap?: unknown }[]): MindMapItem | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const map = usableMindMap(messages[i]?.mindMap);
    if (map) return map;
  }
  return undefined;
}

/** getActiveMindMap plus which message carries it and at what version — what "Expand with AI"
 * and undo need to address the map on the API (see useMindMapExpansion). Walks the same way, so
 * it always points at the map getActiveMindMap would show for the same messages. */
export interface ActiveMindMapRecord {
  messageId: string;
  /** 1 = as generated; each expand adds one, each undo takes one away. */
  version: number;
  data: MindMapItem;
}

export function getActiveMindMapRecord(
  messages: { id: string; mindMap?: { data?: unknown; version?: number } | null }[],
): ActiveMindMapRecord | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const data = usableMindMap(m?.mindMap?.data);
    if (m && data) return { messageId: m.id, version: m.mindMap?.version ?? 1, data };
  }
  return undefined;
}

/**
 * Extracts a mind map structure from AI responses.
 * Supports [MINDMAP]...[/MINDMAP] wrapper, an unclosed tag (streaming cutoff),
 * and a bare JSON object fallback.
 */
export function extractMindMap(text: string): MindMapItem | undefined {
  const mindMapRegex = /\[MINDMAP\]([\s\S]*?)\[\/MINDMAP\]/i;
  const match = text.match(mindMapRegex);

  let jsonStr = "";
  if (match) {
    jsonStr = match[1]!.trim();
  } else {
    const openTagRegex = /\[MINDMAP\]([\s\S]*?)(?:\[TIMELINE\]|\[ILM_META\]|$)/i;
    const openMatch = text.match(openTagRegex);
    if (openMatch) {
      jsonStr = openMatch[1]!.trim();
    } else {
      const blocks = text.split(/[\r\n]{2,}/);
      for (const block of blocks.reverse()) {
        if (block.includes('"id"') && block.includes('"root"')) {
          const fallbackMatch = block.match(/(\{[\s\S]*\})/);
          if (fallbackMatch) {
            jsonStr = fallbackMatch[1]!.trim();
            break;
          }
        }
      }
    }
  }

  if (!jsonStr) return undefined;

  const cleaned = jsonStr
    .replace(/^\uFEFF/, "")
    .replace(/^```json\s*/i, "")
    .replace(/```$/, "")
    .trim();

  const parsed = safeJsonParse(cleaned);
  return normalizeMindMap(parsed);
}

export interface TraceStep {
  id: string;
  tool: string;
  label: string;
  count?: number;
  status: "active" | "done";
}

/**
 * Extracts live research-step events from Chat Wonder's `[TRACE]{...}[/TRACE]`
 * frames (see chat-wonder-v2-api's the_server.py/legal_responses_chain.py,
 * the '[TRACE]' yields alongside broadcast_trace calls). Each tool call emits a
 * 'start' frame (carries the label) and a 'result' frame (carries the count) sharing
 * one `id` — merged here into a single row so the UI updates it in place rather than
 * appending a second line, matching how the source list fills in during research.
 */
export function extractTraceSteps(text: string): TraceStep[] {
  const steps = new Map<string, TraceStep>();
  const traceRegex = /\[TRACE\]([\s\S]*?)\[\/TRACE\]/g;
  let match: RegExpExecArray | null;
  while ((match = traceRegex.exec(text)) !== null) {
    const parsed = safeJsonParse(match[1]!.trim());
    if (!parsed || typeof parsed !== "object" || !parsed.id) continue;
    const existing = steps.get(parsed.id);
    if (parsed.phase === "start") {
      steps.set(parsed.id, {
        id: parsed.id,
        tool: parsed.tool ?? existing?.tool ?? "",
        label: parsed.label ?? existing?.label ?? "",
        count: existing?.count,
        status: "active",
      });
    } else if (parsed.phase === "result" && existing) {
      steps.set(parsed.id, { ...existing, count: parsed.count ?? undefined, status: "done" });
    }
  }
  return Array.from(steps.values());
}

/**
 * Strips [TIMELINE]...[/TIMELINE], [MINDMAP]...[/MINDMAP], and [TRACE]...[/TRACE]
 * blocks (closed or left open by a streaming cutoff) from AI response text before
 * it's displayed.
 */
export function stripStructuredBlocks(text: string): string {
  let cleaned = text
    .replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/gi, "")
    .replace(/\[MINDMAP\][\s\S]*?\[\/MINDMAP\]/gi, "")
    .replace(/\[TRACE\][\s\S]*?\[\/TRACE\]/gi, "");

  const startTags = [/\[TIMELINE\]/i, /\[MINDMAP\]/i, /\[TRACE\]/i];
  let firstTagIdx = -1;
  for (const tag of startTags) {
    const idx = cleaned.search(tag);
    if (idx !== -1 && (firstTagIdx === -1 || idx < firstTagIdx)) firstTagIdx = idx;
  }
  if (firstTagIdx !== -1) cleaned = cleaned.substring(0, firstTagIdx);

  return cleaned.trim();
}

/**
 * Robustly parses a JSON string that may contain unescaped control characters
 * or minor syntax slips from AI-generated content. Returns null on failure.
 */
function safeJsonParse(str: string): any {
  if (!str) return null;

  try {
    const firstBrace = str.indexOf("{");
    const firstBracket = str.indexOf("[");
    const start = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket) ? firstBrace : firstBracket;

    const lastBrace = str.lastIndexOf("}");
    const lastBracket = str.lastIndexOf("]");
    const end = Math.max(lastBrace, lastBracket);

    let jsonPart = str;
    if (start !== -1 && end !== -1 && end > start) {
      jsonPart = str.substring(start, end + 1);
    }

    let sanitized = jsonPart
      .trim()
      .replace(/^\uFEFF/, "")
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/,\s*([}\]])/g, "$1");

    sanitized = sanitized.replace(/\}\s*\{/g, "}, {").replace(/\]\s*\[/g, "], [");

    try {
      return JSON.parse(sanitized);
    } catch {
      let processed = "";
      let inQuote = false;
      let escaped = false;

      for (let i = 0; i < sanitized.length; i++) {
        const char = sanitized[i];

        if (char === '"' && !escaped) {
          if (inQuote) {
            let nextChar = "";
            for (let j = i + 1; j < sanitized.length; j++) {
              if (!/\s/.test(sanitized[j]!)) {
                nextChar = sanitized[j]!;
                break;
              }
            }
            if (nextChar && ![":", ",", "}", "]"].includes(nextChar)) {
              processed += '\\"';
              continue;
            }
          }
          inQuote = !inQuote;
          processed += char;
        } else if (inQuote && !escaped) {
          if (char === "\n") processed += "\\n";
          else if (char === "\r") processed += "\\r";
          else if (char === "\t") processed += "\\t";
          else if (char === "\\") {
            escaped = true;
            processed += char;
          } else {
            const code = char!.charCodeAt(0);
            if (code >= 32) processed += char;
          }
        } else {
          if (escaped) escaped = false;
          processed += char;
        }
      }

      processed = processed
        .replace(/\}\s*\{/g, "}, {")
        .replace(/\]\s*\[/g, "], [")
        .replace(/\}\s*\[/g, "}, [")
        .replace(/\]\s*\{/g, "], {");

      try {
        return JSON.parse(processed);
      } catch {
        let finalAttempt = processed.trim().replace(/,\s*$/, "");

        let isStringOpen = false;
        let isEscape = false;
        const stack: string[] = [];

        for (let i = 0; i < finalAttempt.length; i++) {
          const char = finalAttempt[i];
          if (isEscape) {
            isEscape = false;
            continue;
          }
          if (char === "\\") {
            isEscape = true;
            continue;
          }
          if (char === '"') {
            isStringOpen = !isStringOpen;
            continue;
          }
          if (!isStringOpen) {
            if (char === "{") stack.push("}");
            else if (char === "[") stack.push("]");
            else if (char === "}" || char === "]") {
              if (stack.length > 0 && stack[stack.length - 1] === char) stack.pop();
            }
          }
        }

        if (isStringOpen) finalAttempt += '"';
        while (stack.length > 0) finalAttempt += stack.pop();

        finalAttempt = finalAttempt
          .trim()
          .replace(/,\s*$/, "")
          .replace(/:\s*$/, "")
          .replace(/,\s*"\w*"\s*$/, "")
          .replace(/\{\s*"\w*"\s*$/, "{");

        try {
          return JSON.parse(finalAttempt);
        } catch {
          return null;
        }
      }
    }
  } catch {
    return null;
  }
}
