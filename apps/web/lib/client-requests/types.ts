import type { ClientRequestStatus, Money, PracticeArea, QuoteType, RequestUrgency, UkJurisdiction } from "@/lib/client-handoff"

// ClientRequestForLawyer and its parts, from ilovelawyer-api's swagger-client-handoff.ts
// (GET /api/client-requests, built in #511/#512).

export type ClientRequestInboxView = "inbox" | "mine" | "history"

/** CaseBrief: what every matching lawyer sees before a claim. Never party names, documents or
 * document names. */
export interface CaseBrief {
  summary: string
  practiceArea: PracticeArea | null
  ukJurisdiction: UkJurisdiction | null
  urgency: RequestUrgency
  knownDeadline: string | null
  clientNote: string
  generatedAt: string
}

export interface Quote {
  type: QuoteType
  amount: Money
  message: string
  sentAt: string
}

export interface ClaimSummary {
  byMe: boolean
  /** Only on the holder's own copy, and the organization's OWNER/ADMIN. */
  lawyer?: { id: string; name: string }
  claimedAt: string
  /** 24h after the claim; cleared once the client confirms. */
  claimExpiresAt: string | null
}

export type ChargeStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED"

export interface ChargeSummary {
  id: string
  status: ChargeStatus
  amount: Money
  failureReason: string | null
}

export interface Engagement {
  /** The client's case, open read-only through /my-cases/{caseId}. */
  caseId: string
  /** The client's workspace the case lives in: opened as a shared workspace (X-Organization-Id). */
  workspaceId: string
  clientName: string
  engagedAt: string
  closedAt: string | null
  closedBy: "LAWYER" | "CLIENT" | null
  /** The lawyer's workspace copy, once made. */
  copyCaseId: string | null
}

export interface ClientRequestForLawyer {
  id: string
  status: ClientRequestStatus
  brief: CaseBrief
  routedAt: string | null
  /** 48h after routing, while unclaimed. */
  routingExpiresAt: string | null
  claim: ClaimSummary | null
  quote: Quote | null
  /** What confirming will charge the organization. */
  perCaseFee: Money
  /** The per-case fee, from CONFIRMED. */
  charge: ChargeSummary | null
  engagement: Engagement | null
  assignedTo: { id: string; name: string } | null
}

export interface ClientRequestListResponse {
  total: number
  data: ClientRequestForLawyer[]
}

export interface ConflictParty {
  name: string
  role: string
}
