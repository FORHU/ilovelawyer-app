import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Money, QuoteType, ReleaseReason } from "@/lib/client-handoff"
import { clientRequestKeys } from "@/lib/query-keys"
import { closeClientRequest, copyClientRequestCase, getClientRequest, getConflictParties, getIntakePackage, releaseClientRequest, quoteClientRequest, retryClientRequestCharge } from "./api"

// The claimed-request detail page (#877): the brief, the conflict check's party names, release,
// the quote form, and — once engaged — closing. Claim and pass live in inbox.ts since both the
// inbox list and this page call them.

export function useClientRequestQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: clientRequestKeys.detail(id),
    queryFn: () => getClientRequest(id),
    enabled,
  })
}

/** Party names for the conflict check (#512): only while CLAIMED or QUOTED, and only for the
 * lawyer holding the claim — the API 404s/409s anyone else. Not fetched until the lawyer asks for
 * it (every read is audited on the API side as client_request.parties_viewed). */
export function useConflictPartiesQuery(id: string, enabled: boolean) {
  return useQuery({
    queryKey: clientRequestKeys.parties(id),
    queryFn: () => getConflictParties(id),
    enabled,
    // Each fetch is an audited read: do it when asked, not on every window focus or invalidation.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

/** The engaged lawyer's full read of the client's intake, transcript and documents (ADR 0018).
 * Only enabled once ENGAGED — the API 404s/409s otherwise, and every successful read is audited. */
export function useIntakePackageQuery(id: string, enabled: boolean) {
  return useQuery({
    queryKey: clientRequestKeys.intakePackage(id),
    queryFn: () => getIntakePackage(id),
    enabled,
  })
}

function invalidateRequest(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: clientRequestKeys.detail(id) })
  queryClient.invalidateQueries({ queryKey: clientRequestKeys.lists() })
}

export function useReleaseClientRequestMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { reason: ReleaseReason; note?: string }) => releaseClientRequest(id, input),
    onSuccess: () => invalidateRequest(queryClient, id),
  })
}

export function useQuoteClientRequestMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { type: QuoteType; amount: Money; message: string }) => quoteClientRequest(id, input),
    onSuccess: () => invalidateRequest(queryClient, id),
  })
}

export function useCloseClientRequestMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { note?: string } = {}) => closeClientRequest(id, input),
    onSuccess: () => invalidateRequest(queryClient, id),
  })
}

export function useRetryClientRequestChargeMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => retryClientRequestCharge(id),
    onSuccess: () => invalidateRequest(queryClient, id),
  })
}

export function useCopyClientRequestCaseMutation(id: string) {
  return useMutation({ mutationFn: () => copyClientRequestCase(id) })
}
