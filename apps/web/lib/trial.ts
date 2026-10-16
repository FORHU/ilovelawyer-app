import { useCurrentUserQuery } from "@/lib/user/mutations"

/** Mirrors TRIAL_MESSAGE_LIMIT on the API: AI answers a trial guest gets. */
export const TRIAL_MESSAGE_LIMIT = 5

/** The landing-page trial the signed-in user is on, or null for a real account. */
export function useTrial() {
  const { data } = useCurrentUserQuery()
  if (!data?.trialExpiresAt) return null
  return {
    expiresAt: new Date(data.trialExpiresAt),
    answersLeft: Math.max(0, TRIAL_MESSAGE_LIMIT - data.trialMessagesUsed),
  }
}
