import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { clientRequestKeys } from "@/lib/query-keys"
import type { QuotationInvoice } from "@/lib/client-handoff"

// The client's payment for the lawyer's quote, as the lawyer's invoice: on the request once it's
// engaged, and still there after it closes. `invoice` is null when nothing was paid through
// ilovelawyer (a free first consultation, or a request from before quotation payments).

export function useEngagementInvoiceQuery(requestId: string) {
  return useQuery({
    queryKey: clientRequestKeys.invoice(requestId),
    queryFn: () => apiFetch<{ invoice: QuotationInvoice | null }>(`/api/client-requests/${requestId}/invoice`),
    enabled: !!requestId,
  })
}
