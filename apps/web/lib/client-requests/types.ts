export type RequestUrgency = "high" | "medium" | "low"

/** "open": anyone matching can accept it. "claimed": held by the viewing lawyer.
 * "taken": another lawyer got there first. */
export type ClientRequestStatus = "open" | "claimed" | "taken"

export interface TimelineHighlight {
  date: string
  label: string
  /** A deadline the lawyer is working against — shown in the danger colour. */
  isDeadline?: boolean
}

export interface ClientRequest {
  id: string
  practiceArea: string
  jurisdiction: string
  urgency: RequestUrgency
  /** The deadline behind the urgency, e.g. "ET1 deadline in 23 days". */
  urgencyNote?: string
  title: string
  summary: string
  /** ISO timestamp. */
  receivedAt: string
  documentCount: number
  helperCount: number
  status: ClientRequestStatus
  detail: {
    aiSummary: string
    keyFacts: string[]
    timeline: TimelineHighlight[]
    /** Revealed to the lawyer on claiming, for the conflict check only. */
    clientName: string
    opponentName: string
  }
}

export type QuoteType = "fixed" | "consultation"
