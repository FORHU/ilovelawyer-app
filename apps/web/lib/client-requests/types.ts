import type { ClientRequestStatus, ChargeStatus, Money, PracticeArea, QuoteType, RequestUrgency, UkJurisdiction } from "@/lib/client-handoff"

// The lawyer-facing Client Request shapes (ilovelawyer-api#511, swagger-client-handoff.ts's
// ClientRequestForLawyer/CaseBrief/ClaimSummary/Quote/ChargeSummary/PaymentCard schemas).
// client-handoff.ts only carries the enums and socket events shared with ilovelawyer-client;
// these REST response shapes are lawyer-app only, so they live here instead — same split as
// lib/client-requests/profile.ts's ClientRequestProfile.

/** AI-generated from the case. Never holds party names, document names or documents. */
export interface CaseBrief {
  summary: string
  practiceArea: PracticeArea
  ukJurisdiction: UkJurisdiction
  urgency: RequestUrgency
  /** Date only (no time), e.g. "2026-12-01". */
  knownDeadline: string | null
  clientNote: string
  generatedAt: string
}

export interface ClaimSummary {
  byMe: boolean
  /** Only for the holder and the organization's OWNER/ADMIN. */
  lawyer: { id: string; name: string } | null
  claimedAt: string
  /** 24h after the claim. Cleared once the client confirms. */
  claimExpiresAt: string
}

export interface Quote {
  type: QuoteType
  /** The lawyer's fee to the client, paid to the lawyer directly. The platform takes no cut. */
  amount: Money
  message: string
  sentAt: string
}

export interface ChargeSummary {
  id: string
  status: ChargeStatus
  amount: Money
  failureReason: string | null
}

export interface ClientRequestEngagement {
  caseId: string
  clientName: string
  engagedAt: string
  closedAt: string | null
  closedBy: "LAWYER" | "CLIENT" | null
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
  /** What claiming (then confirming) will charge the organization. */
  perCaseFee: Money
  charge: ChargeSummary | null
  engagement: ClientRequestEngagement | null
  assignedTo: { id: string; name: string } | null
}

export type ClientRequestInboxView = "inbox" | "mine" | "history"

export interface ClientRequestListResponse {
  total: number
  data: ClientRequestForLawyer[]
}

export interface PaymentCard {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}
