import type { ClientRequestForLawyer, ClientRequestInboxView, ClientRequestListResponse, PaymentCard } from "@/lib/client-requests/types"
import { CLIENT_HANDOFF_SOCKET_EVENTS, type ClientRequestTakenEvent } from "@/lib/client-handoff"

/**
 * Stands in for the lawyer-side Client Requests inbox/claim/pass (ilovelawyer-api#511) and the
 * organization's card on file (#505) — neither is built on the API yet (both are still
 * `x-implemented: false` in swagger-client-handoff.ts). #503, which this ticket was blocked on,
 * only shipped the contract (types, swagger, socket-event names) — see client-handoff.ts and
 * lib/client-requests/types.ts, which this mock returns verbatim.
 *
 * Swap-out plan once #511/#505 land: delete this file and liveupdates.ts's BroadcastChannel
 * block, and point lib/client-requests/inbox.ts and billing.ts at apiFetch("/client-requests"...)
 * the same way lib/client-requests/profile.ts already calls the real
 * /users/me/client-request-profile. The function signatures in inbox.ts/billing.ts are written
 * to need no other change.
 *
 * Persisted to localStorage (not just in-memory) so a refresh doesn't lose a claim/pass made
 * during a demo — same reasoning as the client app's mocked lawyer-matching store
 * (ilovelawyer-client/src/lib/store.ts).
 */

const STORAGE_KEY = "ilovelawyer-app:client-requests-mock:v1"
const CARD_STORAGE_KEY = "ilovelawyer-app:client-requests-mock-card:v1"
const CHANNEL_NAME = "ilovelawyer-app:client-requests-mock"

export class ClientRequestApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function seedRequests(): ClientRequestForLawyer[] {
  return [
    {
      id: "mock-req-1",
      status: "ROUTED",
      brief: {
        summary: "Employee dismissed after 3 years' service without a disciplinary process; wants to know whether to bring an unfair dismissal claim.",
        practiceArea: "EMPLOYMENT",
        ukJurisdiction: "England and Wales",
        urgency: "SOON",
        knownDeadline: "2026-12-01",
        clientNote: "I'd prefer a fixed fee if possible.",
        generatedAt: hoursFromNow(-2),
      },
      routedAt: hoursFromNow(-2),
      routingExpiresAt: hoursFromNow(46),
      claim: null,
      quote: null,
      perCaseFee: { amountMinor: 8000, currency: "GBP" },
      charge: null,
      engagement: null,
      assignedTo: null,
    },
    {
      id: "mock-req-2",
      status: "ROUTED",
      brief: {
        summary: "Landlord is withholding a tenancy deposit after the client moved out; dispute over claimed damage to the property.",
        practiceArea: "PROPERTY",
        ukJurisdiction: "Scotland",
        urgency: "ROUTINE",
        knownDeadline: null,
        clientNote: "Happy to go through a deposit scheme's dispute process if that's quicker.",
        generatedAt: hoursFromNow(-5),
      },
      routedAt: hoursFromNow(-5),
      routingExpiresAt: hoursFromNow(43),
      claim: null,
      quote: null,
      perCaseFee: { amountMinor: 8000, currency: "GBP" },
      charge: null,
      engagement: null,
      assignedTo: null,
    },
    {
      id: "mock-req-3",
      status: "ROUTED",
      brief: {
        summary: "Court hearing in 5 days over a contested child arrangements order; client needs representation.",
        practiceArea: "FAMILY",
        ukJurisdiction: "Northern Ireland",
        urgency: "URGENT",
        knownDeadline: hoursFromNow(5 * 24).slice(0, 10),
        clientNote: "This is time-sensitive — the hearing is already scheduled.",
        generatedAt: hoursFromNow(-1),
      },
      routedAt: hoursFromNow(-1),
      routingExpiresAt: hoursFromNow(47),
      claim: null,
      quote: null,
      perCaseFee: { amountMinor: 8000, currency: "GBP" },
      charge: null,
      engagement: null,
      assignedTo: null,
    },
    {
      id: "mock-req-4",
      status: "CLAIMED",
      brief: {
        summary: "Faulty appliance from an online retailer who refuses a refund past their self-declared 14-day window.",
        practiceArea: "CONSUMER",
        ukJurisdiction: "England and Wales",
        urgency: "ROUTINE",
        knownDeadline: null,
        clientNote: "Retailer cited their own terms, which I don't think override statutory rights.",
        generatedAt: hoursFromNow(-30),
      },
      routedAt: hoursFromNow(-30),
      routingExpiresAt: null,
      claim: { byMe: true, lawyer: { id: "me", name: "You" }, claimedAt: hoursFromNow(-6), claimExpiresAt: hoursFromNow(18) },
      quote: null,
      perCaseFee: { amountMinor: 8000, currency: "GBP" },
      charge: null,
      engagement: null,
      assignedTo: { id: "me", name: "You" },
    },
    {
      id: "mock-req-5",
      status: "CLOSED",
      brief: {
        summary: "Dispute with a former business partner over an unpaid invoice.",
        practiceArea: "OTHER",
        ukJurisdiction: "England and Wales",
        urgency: "ROUTINE",
        knownDeadline: null,
        clientNote: "",
        generatedAt: hoursFromNow(-240),
      },
      routedAt: hoursFromNow(-240),
      routingExpiresAt: null,
      claim: { byMe: true, lawyer: { id: "me", name: "You" }, claimedAt: hoursFromNow(-236), claimExpiresAt: hoursFromNow(-212) },
      quote: { type: "FIXED_FEE", amount: { amountMinor: 20000, currency: "GBP" }, message: "Fixed fee to draft and send a formal letter before action.", sentAt: hoursFromNow(-230) },
      perCaseFee: { amountMinor: 8000, currency: "GBP" },
      charge: { id: "mock-charge-5", status: "SUCCEEDED", amount: { amountMinor: 8000, currency: "GBP" }, failureReason: null },
      engagement: {
        caseId: "mock-case-5",
        clientName: "J. Alvarez",
        engagedAt: hoursFromNow(-220),
        closedAt: hoursFromNow(-48),
        closedBy: "LAWYER",
        copyCaseId: null,
      },
      assignedTo: { id: "me", name: "You" },
    },
  ]
}

interface MockState {
  requests: ClientRequestForLawyer[]
  /** Ids this lawyer passed on — excluded from their inbox from then on. */
  passedIds: string[]
  /** One-time "another lawyer claimed it first" demo — see scheduleDemoTakenEvent. */
  demoTakenFired: boolean
}

function loadState(): MockState {
  if (typeof window === "undefined") return { requests: seedRequests(), passedIds: [], demoTakenFired: false }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) throw new Error("no state yet")
    return JSON.parse(raw) as MockState
  } catch {
    const initial: MockState = { requests: seedRequests(), passedIds: [], demoTakenFired: false }
    saveState(initial)
    return initial
  }
}

function saveState(state: MockState): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null
  return new BroadcastChannel(CHANNEL_NAME)
}

/** Mirrors what the real socket would deliver on `client-request:taken` once ilovelawyer-api
 * emits it — same event name and payload, just carried over a BroadcastChannel instead of
 * socket.io so "claim this in one tab, watch it disappear in another" works without a server. */
function broadcastTaken(requestId: string): void {
  const channel = getChannel()
  if (!channel) return
  const payload: ClientRequestTakenEvent = { requestId }
  channel.postMessage({ event: CLIENT_HANDOFF_SOCKET_EVENTS.REQUEST_TAKEN, payload })
  channel.close()
}

function matchesView(request: ClientRequestForLawyer, view: ClientRequestInboxView, passedIds: string[]): boolean {
  if (view === "inbox") return request.status === "ROUTED" && !passedIds.includes(request.id)
  if (view === "mine") return !!request.claim?.byMe && ["CLAIMED", "QUOTED", "CONFIRMED", "ENGAGED"].includes(request.status)
  return !!request.claim?.byMe && ["CLOSED", "EXPIRED", "WITHDRAWN"].includes(request.status)
}

async function delay(ms = 220): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function mockListClientRequests(view: ClientRequestInboxView, page: number, limit: number): Promise<ClientRequestListResponse> {
  await delay()
  const state = loadState()
  const matching = state.requests.filter((r) => matchesView(r, view, state.passedIds))
  const start = (page - 1) * limit
  return { total: matching.length, data: matching.slice(start, start + limit) }
}

export async function mockClaimClientRequest(id: string): Promise<ClientRequestForLawyer> {
  await delay()
  const card = await mockGetBillingCard()
  if (!card) {
    throw new ClientRequestApiError(402, "CARD_REQUIRED", "Add a payment method before accepting a request.")
  }
  const state = loadState()
  const request = state.requests.find((r) => r.id === id)
  if (!request) throw new ClientRequestApiError(404, "NOT_FOUND", "No such request.")
  if (request.status !== "ROUTED") {
    throw new ClientRequestApiError(409, "INVALID_REQUEST_STATUS", "This request isn't available to accept anymore.")
  }
  request.status = "CLAIMED"
  request.claim = { byMe: true, lawyer: { id: "me", name: "You" }, claimedAt: new Date().toISOString(), claimExpiresAt: hoursFromNow(24) }
  request.assignedTo = { id: "me", name: "You" }
  saveState(state)
  broadcastTaken(id)
  return request
}

export async function mockPassClientRequest(id: string): Promise<void> {
  await delay()
  const state = loadState()
  if (!state.requests.some((r) => r.id === id)) throw new ClientRequestApiError(404, "NOT_FOUND", "No such request.")
  if (!state.passedIds.includes(id)) state.passedIds.push(id)
  saveState(state)
}

export async function mockGetBillingCard(): Promise<PaymentCard | null> {
  await delay(120)
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(CARD_STORAGE_KEY)
  return raw ? (JSON.parse(raw) as PaymentCard) : null
}

export async function mockAddBillingCard(card: PaymentCard): Promise<PaymentCard> {
  await delay(400)
  if (typeof window !== "undefined") window.localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(card))
  return card
}

/** One-shot demo of an unprompted `client-request:taken` push — e.g. another lawyer claimed
 * mock-req-2 first — so the live-update path is visible without needing a second browser tab.
 * Fires once per browser (flagged in the persisted state), a few seconds after the inbox is
 * first opened. Real pushes happen whenever they happen; this is purely to make the behavior
 * demonstrable solo. Safe to delete alongside the rest of this file once #511/#509 land. */
export function scheduleDemoTakenEvent(): void {
  const state = loadState()
  if (state.demoTakenFired) return
  const target = state.requests.find((r) => r.id === "mock-req-2" && r.status === "ROUTED")
  if (!target) return
  state.demoTakenFired = true
  saveState(state)
  setTimeout(() => {
    const latest = loadState()
    const request = latest.requests.find((r) => r.id === "mock-req-2")
    if (!request || request.status !== "ROUTED") return
    request.status = "CLAIMED"
    request.claim = { byMe: false, lawyer: null, claimedAt: new Date().toISOString(), claimExpiresAt: hoursFromNow(24) }
    saveState(latest)
    broadcastTaken("mock-req-2")
  }, 7000)
}

export function subscribeMockClientRequestEvents(onTaken: (event: ClientRequestTakenEvent) => void): () => void {
  const channel = getChannel()
  if (!channel) return () => {}
  const handleMessage = (message: MessageEvent<{ event: string; payload: ClientRequestTakenEvent }>) => {
    if (message.data?.event === CLIENT_HANDOFF_SOCKET_EVENTS.REQUEST_TAKEN) onTaken(message.data.payload)
  }
  channel.addEventListener("message", handleMessage)
  return () => {
    channel.removeEventListener("message", handleMessage)
    channel.close()
  }
}
