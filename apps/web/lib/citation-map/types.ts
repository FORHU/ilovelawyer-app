export type CitationTreatment = "FOLLOWED" | "DISTINGUISHED" | "ABANDONED" | "OVERRULED" | "CITED"

export interface CitationMapSeedItem {
  id: string
  quotedText: string
  citedReference: string | null
  /** The case's own citation-validity status (VALID/INVALID/UNVERIFIED/ADVERSE) — distinct
   * from CitationTreatment, which only exists on edges discovered by expanding a node. */
  status: string
  confidence: number | null
  resolved: {
    lawId: string
    title: string
    caseNumber: string | null
    jurisUrl: string
    pdfUrl: string | null
    citationsExtractedAt: string | null
  } | null
}

export interface CitationMapSeed {
  caseId: string
  citations: CitationMapSeedItem[]
}

export interface CitationEdgeToLaw {
  id: string
  title: string
  caseNumber: string | null
  jurisUrl: string
  pdfUrl: string | null
  citationsExtractedAt: string | null
}

export interface CitationEdge {
  id: string
  fromLawId: string
  toLawId: string | null
  toRawReference: string | null
  toRawTitle: string | null
  treatment: CitationTreatment
  /** UK-only: "case" | "legislation" | "si" | "eu" — the UK Legal MCP gives no judicial
   * treatment signal, so this carries the distinction that source actually supports instead.
   * Null for PH edges. */
  citationType: string | null
  excerpt: string | null
  confidence: number | null
  toLaw: CitationEdgeToLaw | null
}

export interface CitationEdgesResponse {
  status: "DONE" | "IN_PROGRESS"
  edges: CitationEdge[]
}
