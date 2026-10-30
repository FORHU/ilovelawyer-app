import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { practiceAreaKeys, userKeys } from "@/lib/query-keys"

// A lawyer's Lawyer Application, UK or PH (the lawyer's site): ilovelawyer-api
// GET/PATCH /api/users/me/client-request-profile (the path predates PH). On UK it also holds the
// settings for receiving clients from the client app; on PH approval only shows a badge for now.

/** Sites with a Lawyer Application. Mirrors LAWYER_COUNTRIES in ilovelawyer-api's
 * constants/lawyer-application.constants.ts. */
export type LawyerCountry = "UK" | "PH"

export const REGULATORS = ["SRA", "LSS", "LSNI"] as const
export type Regulator = (typeof REGULATORS)[number]

export const UK_JURISDICTIONS = ["England and Wales", "Scotland", "Northern Ireland"] as const

/** One practice area a lawyer can pick on their site. Admins manage the lists in ilovelawyer-admin,
 * so names come from the API as they are, untranslated. */
export interface PracticeAreaOption {
  id: string
  name: string
}

/** A practice area on the lawyer's application. `isActive` false: an admin has since switched it
 * off. The lawyer keeps it until they drop it, but it brings no new requests and can't be re-added. */
export interface LawyerPracticeArea extends PracticeAreaOption {
  isActive: boolean
}

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
  /** In the site's order. */
  practiceAreas: LawyerPracticeArea[]
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
  /** Replaces the areas held: ids from usePracticeAreasQuery, plus any switched-off one being kept. */
  practiceAreaIds?: string[]
  bio?: string
  languages?: string[]
  firstConsultationFee?: ClientRequestProfile["firstConsultationFee"]
  acceptingRequests?: boolean
  pausedUntil?: string | null
  capacityLimit?: number | null
}

const PATH = "/api/users/me/client-request-profile"

/** `pollWhilePending`: the /verification waiting step, which must notice a rejection without a
 * reload — the plan gate stays AWAITING_VERIFICATION through one, so its own poll can't. */
export function useClientRequestProfileQuery(enabled: boolean, { pollWhilePending = false } = {}) {
  return useQuery({
    queryKey: userKeys.clientRequestProfile(),
    queryFn: () => apiFetch<ClientRequestProfile>(PATH),
    enabled,
    refetchInterval: (query) => (pollWhilePending && query.state.data?.verification.status === "PENDING" ? 60_000 : false),
  })
}

/** The practice areas a lawyer can pick on their site (GET /api/practice-areas): switched-on ones
 * only, in the order admins set. */
export function usePracticeAreasQuery(country: LawyerCountry) {
  return useQuery({
    queryKey: practiceAreaKeys.list(country),
    queryFn: () => apiFetch<PracticeAreaOption[]>(`/api/practice-areas?country=${country}`),
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
