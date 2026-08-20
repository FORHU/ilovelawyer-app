// Client-side mirror of ilovelawyer-api's src/utils/response-parser.ts, itself ported from
// law-ph's lib/citation-parser.ts. The API only strips/persists the [MINDMAP]...[/MINDMAP]
// block from the *final* response — the raw stream handed to onChunk in sendChatMessage still
// contains it, so the frontend needs its own extractor/stripper to keep it out of the live
// streaming bubble and to read the tree out as it arrives.

export interface MindMapItem {
  id: string;
  label: string;
  description?: string;
  isRoot?: boolean;
  children: MindMapItem[];
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

/**
 * Strips [TIMELINE]...[/TIMELINE] and [MINDMAP]...[/MINDMAP] blocks (closed or
 * left open by a streaming cutoff) from AI response text before it's displayed.
 */
export function stripStructuredBlocks(text: string): string {
  let cleaned = text
    .replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/gi, "")
    .replace(/\[MINDMAP\][\s\S]*?\[\/MINDMAP\]/gi, "");

  const startTags = [/\[TIMELINE\]/i, /\[MINDMAP\]/i];
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
