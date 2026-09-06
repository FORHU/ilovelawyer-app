import type { CitationTreatment } from "@/lib/citation-map/types"

export const ROOT_COLOR = "#722f37"

// Seed-tier nodes are colored by the case's own citation-validity status.
export const STATUS_COLORS: Record<string, string> = {
  VALID: "#16a34a",
  INVALID: "#dc2626",
  ADVERSE: "#ea580c",
  UNVERIFIED: "#64748b",
}

// Expanded-tier nodes (from a CitationEdge) are colored by how the citing decision treats them.
export const TREATMENT_COLORS: Record<CitationTreatment, string> = {
  FOLLOWED: "#16a34a",
  DISTINGUISHED: "#d97706",
  ABANDONED: "#dc2626",
  OVERRULED: "#dc2626",
  CITED: "#3b82f6",
}

export const UNRESOLVED_COLOR = "#94a3b8"

// UK edges carry no judicial treatment (the UK Legal MCP doesn't give one), so they're colored
// by citation type instead — a real distinction that source actually supports.
export const CITATION_TYPE_COLORS: Record<string, string> = {
  case: "#3b82f6",
  legislation: "#8b5cf6",
  si: "#0d9488",
  eu: "#64748b",
}

export const NODE_RADIUS_BY_DEPTH: Record<number, number> = {
  0: 11,
  1: 8,
  2: 6,
  3: 4.5,
}

// Depth 0 = the case, 1 = its own citations, 2/3 = successive expansions — matches the
// reference product's "three levels deep." Nodes at MAX_DEPTH have no expand affordance.
export const MAX_DEPTH = 3
