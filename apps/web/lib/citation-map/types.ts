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

/** A pleaded claim — the "ground" authorities attach to in the list view. */
export interface CitationMapClaim {
  id: string
  title: string
  causeOfAction: string | null
  /** AI = found in the pleadings; sourceLabel/sourceQuote say where. */
  source: "MANUAL" | "AI"
  sourceLabel: string | null
  sourceQuote: string | null
}

/** Jev's check of one link (USE_JEV_CITATION_GROUNDS). */
export interface CitationGroundJevCheck {
  attaches: "SUPPORTS_GROUND" | "TANGENTIAL" | "DOES_NOT_APPLY"
  confidence: number
}

/** One authority (a seed citation) attached to one claim. */
export interface CitationGround {
  id: string
  citationCheckId: string
  claimId: string
  role: "SUBSTANTIVE" | "PROCEDURAL"
  source: "MANUAL" | "AI"
  /** The mapping model's one-line reason; null on manual links. */
  reason: string | null
  /** Null when Jev wasn't run or its call failed. */
  jev: CitationGroundJevCheck | null
}

/** One adverse signal against a cited authority, from the sweep. */
export interface AdverseCitationHit {
  id: string
  citationCheckId: string
  /** OWN_STATUS: the case's own citation check marked it ADVERSE. NEGATIVE_TREATMENT: a later
   * decision in the corpus overruled, abandoned or distinguished it. */
  kind: "OWN_STATUS" | "NEGATIVE_TREATMENT"
  treatment: "OVERRULED" | "ABANDONED" | "DISTINGUISHED" | null
  citingTitle: string | null
  excerpt: string | null
  /** Jev's read (USE_JEV_ADVERSE_SWEEP); null for OWN_STATUS or when not run. */
  jev: { effect: "DEFEATS_PROPOSITION" | "DISTINGUISHABLE" | "NOT_ADVERSE"; confidence: number } | null
  /** Worth a Weakness — offered to the lawyer, never added on its own. */
  suggested: boolean
  suggestionStatus: "PENDING" | "ACCEPTED" | "DISMISSED"
  weaknessId: string | null
}

export interface CitationMapSweep {
  /** Null until the first sweep. */
  sweptAt: string | null
  /** Cited authorities, and how many resolved into the corpus the sweep can search. */
  authorities: number
  inCorpus: number
  hits: AdverseCitationHit[]
}

export interface CitationMapSeed {
  caseId: string
  citations: CitationMapSeedItem[]
  claims: CitationMapClaim[]
  grounds: CitationGround[]
  sweep: CitationMapSweep
}

export interface CitationEdgeToLaw {
  id: string
  title: string
  caseNumber: string | null
  jurisUrl: string
  pdfUrl: string | null
  citationsExtractedAt: string | null
  /** Present on the /api/law/:id/citations response (the full Law row is included). Lets the
   * Library detail page link an edge to the right category tab. */
  category?: "JURISPRUDENCE" | "REPUBLIC_ACT"
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
