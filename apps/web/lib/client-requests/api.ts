import { apiFetch } from "@/lib/fetch"
import type { Money, QuoteType, ReleaseReason } from "@/lib/client-handoff"
import type { ClientRequestForLawyer, ClientRequestInboxView, ClientRequestListResponse, ConflictParty, IntakePackageForLawyer } from "./types"

// REST calls for the Client Requests inbox and a held request (ilovelawyer-api#511/#512),
// mounted at /api/client-requests. The hooks in inbox.ts and detail.ts wrap these in React Query.

export function listClientRequests(view: ClientRequestInboxView, page: number, limit: number) {
  return apiFetch<ClientRequestListResponse>(`/api/client-requests?view=${view}&page=${page}&limit=${limit}`)
}

export function getClientRequest(id: string) {
  return apiFetch<ClientRequestForLawyer>(`/api/client-requests/${id}`)
}

export function claimClientRequest(id: string) {
  return apiFetch<ClientRequestForLawyer>(`/api/client-requests/${id}/claim`, { method: "POST" })
}

export function passClientRequest(id: string) {
  return apiFetch<void>(`/api/client-requests/${id}/pass`, { method: "POST" })
}

export function getConflictParties(id: string) {
  return apiFetch<{ parties: ConflictParty[] }>(`/api/client-requests/${id}/parties`)
}

/** The client's full intake (ADR 0018 in the API repo): the case, the transcript, the documents
 * and the live CaseIntake. Only once ENGAGED, for the lawyer that engagement is for; every read
 * is audited on the API side (client_request.intake_package_viewed). */
export function getIntakePackage(id: string) {
  return apiFetch<IntakePackageForLawyer>(`/api/client-requests/${id}/intake-package`)
}

export function releaseClientRequest(id: string, input: { reason: ReleaseReason; note?: string }) {
  return apiFetch<ClientRequestForLawyer>(`/api/client-requests/${id}/release`, { method: "POST", body: JSON.stringify(input) })
}

export function quoteClientRequest(id: string, input: { type: QuoteType; amount: Money; message: string }) {
  return apiFetch<ClientRequestForLawyer>(`/api/client-requests/${id}/quote`, { method: "POST", body: JSON.stringify(input) })
}

export function closeClientRequest(id: string, input: { note?: string } = {}) {
  return apiFetch<ClientRequestForLawyer>(`/api/client-requests/${id}/close`, { method: "POST", body: JSON.stringify(input) })
}

/** After the per-case fee's card was declined and the organization updated it — CONFIRMED only. */
export function retryClientRequestCharge(id: string) {
  return apiFetch<ClientRequestForLawyer>(`/api/client-requests/${id}/charge/retry`, { method: "POST" })
}

/** Copies the engaged client's case into the lawyer's own workspace (queued). */
export function copyClientRequestCase(id: string) {
  return apiFetch<{ caseCopyId: string; status: "PENDING" | "DONE" | "FAILED" }>(`/api/client-requests/${id}/copy`, { method: "POST" })
}
