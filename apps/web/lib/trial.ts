import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { useCurrentUserQuery } from "@/lib/user/mutations"

/** The capped Studio features a chat-only trial guest can use (TRIAL_FEATURE_LIMITS in the API). */
export type TrialFeature = "mindMap" | "audioOverview" | "audioRecording" | "caseBrief"

/** The landing-page trial the signed-in user is on, or null for a real account. `CHAT` is the
 * chat-only trial (an answer count, a clock, most of the product greyed out); `FULL` is the whole
 * product with nothing greyed out, limited only by its spend (useTrialBudget). `featuresLeft`:
 * uses left of each capped Studio feature on the chat-only trial; the API enforces them, this only
 * shows them. */
export function useTrial() {
  const { data } = useCurrentUserQuery()
  if (!data?.trialKind) return null
  return {
    kind: data.trialKind,
    expiresAt: data.trialExpiresAt ? new Date(data.trialExpiresAt) : null,
    answersLeft: data.trialMessagesLeft ?? 0,
    featuresLeft: (data.trialFeaturesLeft ?? null) as Record<TrialFeature, number> | null,
  }
}

/** The chat-only trial, or null for a real account or a full-trial guest: what every greyed-out
 * control and locked page checks, since the full trial has nothing locked. */
export function useChatTrial() {
  const trial = useTrial()
  return trial?.kind === "CHAT" ? trial : null
}

/** A full-trial guest's spend so far against the budget (GET /api/trial/budget), polled so the
 * banner keeps up with work running in the background. Undefined for anyone else. `spent` once
 * the budget is reached: the API then refuses new AI work with TRIAL_BUDGET_SPENT. */
export function useTrialBudget() {
  const trial = useTrial()
  const { data } = useQuery({
    queryKey: ["trial", "budget"],
    queryFn: () => apiFetch<{ budgetUsd: number | null; spentUsd: number }>("/api/trial/budget"),
    enabled: trial?.kind === "FULL",
    refetchInterval: 10_000,
  })
  if (trial?.kind !== "FULL" || !data) return undefined
  const budgetUsd = data.budgetUsd ?? 0
  return { budgetUsd, spentUsd: data.spentUsd, leftUsd: Math.max(0, budgetUsd - data.spentUsd), spent: data.spentUsd >= budgetUsd }
}

/** The trial's limits as the API is configured (TRIAL_MESSAGE_LIMIT, TRIAL_DURATION_HOURS and
 * TRIAL_BUDGET_USD there): the start screen shows them before any guest exists. `budgetUsd` is
 * null when the full trial is not offered. Undefined until it loads. */
export function useTrialConfig() {
  const { data } = useQuery({
    queryKey: ["trial", "config"],
    queryFn: () => apiFetch<{ messageLimit: number; durationHours: number; budgetUsd: number | null }>("/api/trial/config"),
    staleTime: Infinity,
  })
  return data
}
