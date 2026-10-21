import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { userKeys } from "@/lib/query-keys"

// A lawyer's settings for receiving clients from the client app (UK only):
// ilovelawyer-api GET/PATCH /api/users/me/client-request-profile.

export const REGULATORS = ["SRA", "LSS", "LSNI"] as const
export type Regulator = (typeof REGULATORS)[number]

export const UK_JURISDICTIONS = ["England and Wales", "Scotland", "Northern Ireland"] as const

/** What the client app's cases can be about. Personal injury is never one: referral fees are
 * banned there, so it's shown but can't be picked. */
export const PRACTICE_AREAS = ["EMPLOYMENT", "PROPERTY", "FAMILY", "CONSUMER", "OTHER"] as const
export type PracticeArea = (typeof PRACTICE_AREAS)[number]

export type VerificationStatus = "UNSUBMITTED" | "PENDING" | "VERIFIED" | "REJECTED"

export interface ClientRequestProfile {
  regulator: Regulator | null
  registrationNumber: string | null
  qualifiedJurisdictions: string[]
  practiceAreas: PracticeArea[]
  bio: string
  languages: string[]
  /** Pence. */
  firstConsultationFee: { amountMinor: number; currency: "GBP" } | null
  acceptingRequests: boolean
  /** The organization's switch for this member (set by an owner or admin). */
  enabledByOrganization: boolean
  pausedUntil: string | null
  capacityLimit: number | null
  openEngagements: number
  verification: { status: VerificationStatus; note: string | null; verifiedAt: string | null }
  /** Required fields still empty. */
  missing: string[]
}

export type ClientRequestProfilePatch = Partial<
  Pick<
    ClientRequestProfile,
    | "regulator"
    | "registrationNumber"
    | "qualifiedJurisdictions"
    | "practiceAreas"
    | "bio"
    | "languages"
    | "firstConsultationFee"
    | "acceptingRequests"
    | "pausedUntil"
    | "capacityLimit"
  >
>

const PATH = "/api/users/me/client-request-profile"

export function useClientRequestProfileQuery(enabled: boolean) {
  return useQuery({
    queryKey: userKeys.clientRequestProfile(),
    queryFn: () => apiFetch<ClientRequestProfile>(PATH),
    enabled,
  })
}

export function useUpdateClientRequestProfileMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: ClientRequestProfilePatch) =>
      apiFetch<ClientRequestProfile>(PATH, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: (profile) => queryClient.setQueryData(userKeys.clientRequestProfile(), profile),
  })
}
