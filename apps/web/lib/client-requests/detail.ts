import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { clientRequestKeys } from "@/lib/query-keys"
import {
  closeClientRequest,
  copyClientRequestCase,
  getClientRequest,
  getIntakePackage,
  quoteClientRequest,
  retryClientRequestCharge,
  withdrawClientRequestQuotation,
  type CloseInput,
  type QuotationInput,
} from "./api"

// The claimed-request detail page (#877): the brief, the quote form, and — once engaged — closing. Claim and pass live in inbox.ts since both the
// inbox list and this page call them.

export function useClientRequestQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: clientRequestKeys.detail(id),
    queryFn: () => getClientRequest(id),
    enabled,
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

export function useQuoteClientRequestMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: QuotationInput) => quoteClientRequest(id, input),
    onSuccess: () => invalidateRequest(queryClient, id),
  })
}

export function useWithdrawQuotationMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => withdrawClientRequestQuotation(id),
    onSuccess: () => invalidateRequest(queryClient, id),
  })
}

export function useCloseClientRequestMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CloseInput = {}) => closeClientRequest(id, input),
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
