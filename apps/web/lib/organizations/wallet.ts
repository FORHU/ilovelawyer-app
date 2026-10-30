import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { walletKeys } from "@/lib/query-keys"
import type { EarningStatus, Money, WithdrawalStatus } from "@/lib/client-handoff"
import { OWN_WORKSPACE_ID } from "@/lib/store/auth.store"

/** Where a payee's wallet lives in the API: a firm's under /organizations/:id/wallet (Owners and
 * Admins only), a solo lawyer's own (OWN_WORKSPACE_ID) under /users/me/wallet. Same shapes either way. */
function walletPath(organizationId: string): string {
  return organizationId === OWN_WORKSPACE_ID ? "/api/users/me/wallet" : `/api/organizations/${organizationId}/wallet`
}

/** Wallet in the contract: the balances, where payouts go, and the tenant's terms. */
export interface Wallet {
  id: string
  currency: string
  balances: {
    /** Earnings still in their hold. */
    pending: Money
    /** Free to withdraw. Can be below zero after a refund of money already withdrawn. */
    available: Money
    /** On its way to the bank. */
    reserved: Money
    /** Paid out. */
    withdrawn: Money
  }
  payoutAccount: {
    provider: "STRIPE" | "DUMMY" | null
    connected: boolean
    detailsSubmitted: boolean
    payoutsEnabled: boolean
  }
  minWithdrawal: Money
  earningsHoldDays: number | null
}

/** One client payment's share for the lawyer: their full service fee. */
export interface Earning {
  id: string
  requestId: string
  quotationId: string
  status: EarningStatus
  gross: Money
  platformFee: Money
  net: Money
  reversed: Money
  disputed: boolean
  availableAt: string
  releasedAt: string | null
  createdAt: string
}

export interface Withdrawal {
  id: string
  status: WithdrawalStatus
  amount: Money
  failureReason: string | null
  paidAt: string | null
  createdAt: string
}

export interface Page<T> {
  total: number
  data: T[]
}

export const WALLET_PAGE_SIZE = 10

export function useWalletQuery(organizationId: string) {
  return useQuery({
    queryKey: walletKeys.wallet(organizationId),
    queryFn: () => apiFetch<Wallet>(walletPath(organizationId)),
    enabled: !!organizationId,
  })
}

export function useWalletEarningsQuery(organizationId: string, page: number) {
  return useQuery({
    queryKey: walletKeys.earnings(organizationId, page),
    queryFn: () => apiFetch<Page<Earning>>(`${walletPath(organizationId)}/earnings?page=${page}&limit=${WALLET_PAGE_SIZE}`),
    enabled: !!organizationId,
    placeholderData: keepPreviousData,
  })
}

export function useWalletWithdrawalsQuery(organizationId: string, page: number) {
  return useQuery({
    queryKey: walletKeys.withdrawals(organizationId, page),
    queryFn: () => apiFetch<Page<Withdrawal>>(`${walletPath(organizationId)}/withdrawals?page=${page}&limit=${WALLET_PAGE_SIZE}`),
    enabled: !!organizationId,
    placeholderData: keepPreviousData,
  })
}

/** Starts or carries on setting up where payouts go. Resolves to Stripe's onboarding page to send
 * the browser to, or null with the dummy provider (ready at once). Bank details never reach this
 * app or its API. */
export function useStartPayoutOnboardingMutation(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (returnUrl: string) =>
      apiFetch<{ url: string | null; wallet: Wallet }>(`${walletPath(organizationId)}/payout-account/onboarding-link`, {
        method: "POST",
        body: JSON.stringify({ returnUrl }),
      }),
    onSuccess: (result) => queryClient.setQueryData(walletKeys.wallet(organizationId), result.wallet),
  })
}

/** Back from Stripe's onboarding: reads the account's state again, before Stripe's webhook arrives. */
export function useRefreshPayoutAccountMutation(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<Wallet>(`${walletPath(organizationId)}/payout-account/refresh`, { method: "POST" }),
    onSuccess: (wallet) => queryClient.setQueryData(walletKeys.wallet(organizationId), wallet),
  })
}

/** Withdraws to the bank. `idempotencyKey` is one per attempt the lawyer makes, so a retried request
 * can't pay out twice. */
export function useWithdrawMutation(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ amountMinor, idempotencyKey }: { amountMinor: number; idempotencyKey: string }) =>
      apiFetch<Withdrawal>(`${walletPath(organizationId)}/withdrawals`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ amount: { amountMinor, currency: "GBP" } }),
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: walletKeys.all(organizationId) }),
  })
}
