import type { CitationTreatment } from "@/lib/citation-map/types"

export type GraphNodeKind = "case" | "law" | "raw"

export interface GraphNode {
  id: string
  label: string
  kind: GraphNodeKind
  depth: number
  color: string
  lawId?: string
  jurisUrl?: string
  pdfUrl?: string | null
  caseNumber?: string | null
  /** Seed-tier (the case's own citation) validity: VALID/INVALID/UNVERIFIED/ADVERSE. */
  status?: string
  /** Expanded-tier (from a CitationEdge) treatment. */
  treatment?: CitationTreatment
  /** UK-only: "case" | "legislation" | "si" | "eu" — preferred over treatment for coloring/
   * labeling when present, since UK has no treatment signal to give. */
  citationType?: string | null
  excerpt?: string | null
  x?: number
  y?: number
}

export interface GraphLink {
  source: string
  target: string
}
