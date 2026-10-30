import type { ClaimOutcome, ClientRequestStatus, Money, QuoteType, RequestUrgency, UkJurisdiction } from "@/lib/client-handoff"

// ClientRequestForLawyer and its parts, from ilovelawyer-api's swagger-client-handoff.ts
// (GET /api/client-requests, built in #511/#512).

export type ClientRequestInboxView = "inbox" | "mine" | "history"

/** CaseBrief: what every matching lawyer sees before a claim. Never party names, documents or
 * document names. */
export interface CaseBrief {
  summary: string
  /** The case's areas by name, as when the brief was written. */
  caseAreas: string[]
  ukJurisdiction: UkJurisdiction | null
  urgency: RequestUrgency
  knownDeadline: string | null
  clientNote: string
  generatedAt: string
  /** The client's intake (docs/adr/0018-client-app-is-intake-not-advice.md in the API repo),
   * redacted the same way summary/clientNote are: no names, no document names, no source ids.
   * Null until the client's intake has run at least once. */
  intake: AnonymisedIntake | null
}

export interface IntakeCompleteness {
  ready: boolean
  criteria: { key: string; label: string; met: boolean }[]
}

/** The redacted shape of the client's intake a lawyer sees before claiming (CaseBrief.intake). */
export interface AnonymisedIntake {
  timeline: { id: string; date: string | null; datePrecision: "DAY" | "MONTH" | "YEAR" | "UNKNOWN"; text: string }[]
  goals: { id: string; text: string }[]
  concerns: { id: string; text: string }[]
  questionsForLawyer: { id: string; text: string }[]
  deadlines: { id: string; date: string | null; text: string }[]
  missing: { id: string; question: string; why: string }[]
  completeness: IntakeCompleteness | null
}

/** The full intake (GET /client-requests/{id}/intake-package, ENGAGED only): real names and
 * document names — the lawyer already has full case access through the engagement grant. Each
 * item's own source(s) say whether it's something the client entered on the case form, said in
 * the Interview, or came from a document (and which page) — never shown as settled fact beyond
 * what its source actually supports. */
export type IntakeSourceKind = "CASE_DETAILS" | "CLIENT" | "DOCUMENT"
export interface IntakeSource {
  kind: IntakeSourceKind
  messageId: string | null
  documentId: string | null
  documentName: string | null
  page: number | null
}
export interface IntakeItem {
  id: string
  text: string
  sources: IntakeSource[]
}
export interface IntakePerson {
  id: string
  name: string
  role: string
  sources: IntakeSource[]
}
export interface IntakeEvent {
  id: string
  text: string
  date: string | null
  sources: IntakeSource[]
}
export interface IntakeDeadline {
  id: string
  text: string
  date: string | null
  sources: IntakeSource[]
}
export interface IntakeGap {
  id: string
  question: string
  why: string
}
export interface IntakeConflict {
  id: string
  description: string
  sources: IntakeSource[]
}
export interface CaseIntake {
  generatedAt: string | null
  status: "EMPTY" | "RUNNING" | "READY" | "FAILED" | "STALE"
  summary: string | null
  people: IntakePerson[]
  timeline: IntakeEvent[]
  facts: IntakeItem[]
  goals: IntakeItem[]
  concerns: IntakeItem[]
  questionsForLawyer: IntakeItem[]
  deadlines: IntakeDeadline[]
  missing: IntakeGap[]
  conflicts: IntakeConflict[]
  completeness: IntakeCompleteness | null
}

export interface IntakePackageMessage {
  id: string
  role: "CLIENT" | "AI"
  text: string
  createdAt: string
}

export interface IntakePackageDocument {
  id: string
  name: string
  status: "PENDING" | "READY" | "FAILED"
  category: string | null
  url: string | null
}

export interface IntakePackageForLawyer {
  requestId: string
  caseId: string
  caseDetails: {
    title: string
    caseAreas: string[]
    ukJurisdiction: UkJurisdiction | null
    town: string | null
    side: "CLAIMANT" | "RESPONDENT" | null
    otherParties: { name: string; role: string }[]
    clientNote: string
  }
  intake: CaseIntake
  transcript: IntakePackageMessage[]
  documents: IntakePackageDocument[]
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
  /** 24h after joining: the time to quote. A quoted claim waits for the client. */
  claimExpiresAt: string | null
  /** Null while it's open. NOT_CHOSEN: the client hired another lawyer, or didn't pick in time. */
  outcome?: ClaimOutcome | null
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
  /** 48h after routing: until then, lawyers can join while a place is free. */
  routingExpiresAt: string | null
  /** Several lawyers (phase 5): how many are on it now, of maxLawyers. */
  lawyersOn?: number
  maxLawyers?: number
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
