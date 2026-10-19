import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { useCurrentUserQuery } from "@/lib/user/mutations"

/** The capped Studio features a trial guest can use on the sample case (TRIAL_FEATURE_LIMITS in the API). */
export type TrialFeature = "mindMap" | "audioOverview" | "audioRecording" | "caseBrief"

/** The landing-page trial the signed-in user is on, or null for a real account. `featuresLeft`:
 * uses left of each capped Studio feature; the API enforces them, this only shows them. */
export function useTrial() {
  const { data } = useCurrentUserQuery()
  if (!data?.trialExpiresAt) return null
  return {
    expiresAt: new Date(data.trialExpiresAt),
    answersLeft: data.trialMessagesLeft ?? 0,
    featuresLeft: (data.trialFeaturesLeft ?? null) as Record<TrialFeature, number> | null,
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
