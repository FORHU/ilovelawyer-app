import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { userKeys } from "@/lib/query-keys"

// A lawyer's Lawyer Application, UK or PH (the lawyer's site): ilovelawyer-api
// GET/PATCH /api/users/me/client-request-profile (the path predates PH). On UK it also holds the
// settings for receiving clients from the client app; on PH approval only shows a badge for now.

/** Sites with a Lawyer Application. Mirrors LAWYER_COUNTRIES in ilovelawyer-api's
 * constants/lawyer-application.constants.ts. */
export type LawyerCountry = "UK" | "PH"

export const REGULATORS = ["SRA", "LSS", "LSNI"] as const
export type Regulator = (typeof REGULATORS)[number]

export const UK_JURISDICTIONS = ["England and Wales", "Scotland", "Northern Ireland"] as const

/** What the client app's cases can be about. Personal injury is never one: referral fees are
 * banned there, so it's shown but can't be picked. */
export const PRACTICE_AREAS = ["EMPLOYMENT", "PROPERTY", "FAMILY", "CONSUMER", "OTHER"] as const
export type PracticeArea = (typeof PRACTICE_AREAS)[number]

/** The PH list, separate from the UK one. Not final: the PH rules are still being settled. */
export const PH_PRACTICE_AREAS = ["CIVIL", "CRIMINAL", "FAMILY", "LABOR", "CORPORATE", "PROPERTY", "TAX", "IMMIGRATION", "ADMINISTRATIVE", "OTHER"] as const
export type PhPracticeArea = (typeof PH_PRACTICE_AREAS)[number]

export const PRACTICE_AREAS_BY_COUNTRY: Record<LawyerCountry, readonly string[]> = { UK: PRACTICE_AREAS, PH: PH_PRACTICE_AREAS }

export const FEE_CURRENCY: Record<LawyerCountry, "GBP" | "PHP"> = { UK: "GBP", PH: "PHP" }

export type VerificationStatus = "UNSUBMITTED" | "PENDING" | "VERIFIED" | "REJECTED"

export interface UkRegistration {
  country: "UK"
  regulator: Regulator | null
  registrationNumber: string | null
  qualifiedJurisdictions: string[]
}

export interface PhRegistration {
  country: "PH"
  /** Roll of Attorneys number (Supreme Court). Required to submit. */
  rollNumber: string | null
  /** Integrated Bar of the Philippines chapter. Required to submit. */
  ibpChapter: string | null
  ibpMembershipNumber: string | null
  mcleNumber: string | null
  /** As on the MCLE certificate, e.g. "VII". */
  mclePeriod: string | null
}

export type Registration = UkRegistration | PhRegistration

export interface ClientRequestProfile {
  country: LawyerCountry
  registration: Registration
  practiceAreas: string[]
  bio: string
  languages: string[]
  /** Minor units: pence on UK, centavos on PH. */
  firstConsultationFee: { amountMinor: number; currency: "GBP" | "PHP" } | null
  /** UK only: the lawyer's own switch for receiving client requests. */
  acceptingRequests: boolean
  /** The organization's switch for this member (set by an owner or admin). */
  enabledByOrganization: boolean
  pausedUntil: string | null
  capacityLimit: number | null
  openEngagements: number
  verification: { status: VerificationStatus; note: string | null; verifiedAt: string | null }
  /** Required fields still empty. UK: regulator, registrationNumber, qualifiedJurisdictions,
   * practiceAreas. PH: rollNumber, ibpChapter, practiceAreas. */
  missing: string[]
}

/** A save. `registration` must be the lawyer's own country's; leave a field out to keep it. */
export interface ClientRequestProfilePatch {
  registration?: ({ country: "UK" } & Partial<Omit<UkRegistration, "country">>) | ({ country: "PH" } & Partial<Omit<PhRegistration, "country">>)
  practiceAreas?: string[]
  bio?: string
  languages?: string[]
  firstConsultationFee?: ClientRequestProfile["firstConsultationFee"]
  acceptingRequests?: boolean
  pausedUntil?: string | null
  capacityLimit?: number | null
}

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
