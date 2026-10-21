import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { billingKeys } from "@/lib/query-keys"
import type { PaymentCard } from "@/lib/client-requests/types"
import { mockAddBillingCard, mockGetBillingCard } from "@/lib/client-requests/mock-backend"

// The organization's card on file for accepting client requests (ilovelawyer-api#505 —
// GET/POST /organizations/{id}/billing/card, Stripe-hosted setup). Not built yet, so this calls
// the same mock-backend.ts the inbox does; see its header comment for the swap-out plan. The
// real setup-session route returns a Stripe Checkout URL to redirect to, with the card saved by
// a webhook on return — this mock skips the redirect and takes the (fake) card details directly,
// since there's no Stripe integration anywhere in ilovelawyer-api to redirect to yet.

export function useBillingCardQuery(organizationId: string | undefined) {
  return useQuery({
    queryKey: billingKeys.card(organizationId ?? ""),
    queryFn: () => mockGetBillingCard(),
    enabled: !!organizationId,
  })
}

export function useAddBillingCardMutation(organizationId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (card: PaymentCard) => mockAddBillingCard(card),
    onSuccess: (card) => {
      if (organizationId) queryClient.setQueryData(billingKeys.card(organizationId), card)
    },
  })
}
