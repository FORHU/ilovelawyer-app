import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { useCurrentUserQuery } from "@/lib/user/mutations"

/** The landing-page trial the signed-in user is on, or null for a real account. */
export function useTrial() {
  const { data } = useCurrentUserQuery()
  if (!data?.trialExpiresAt) return null
  return {
    expiresAt: new Date(data.trialExpiresAt),
    answersLeft: data.trialMessagesLeft ?? 0,
  }
}

/** The trial's limits as the API is configured (TRIAL_MESSAGE_LIMIT and TRIAL_DURATION_HOURS
 * there), and whether it offers the sample case (TRIAL_SAMPLE_CASE_ID): the start screen shows them
 * before any guest exists. Undefined until it loads. */
export function useTrialConfig() {
  const { data } = useQuery({
    queryKey: ["trial", "config"],
    queryFn: () => apiFetch<{ messageLimit: number; durationHours: number; sampleCase?: boolean }>("/api/trial/config"),
    staleTime: Infinity,
  })
  return data
}
