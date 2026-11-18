import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { practiceAreaKeys, userKeys } from "@/lib/query-keys"

// A lawyer's Lawyer Application, UK, PH or KR (the lawyer's site): ilovelawyer-api
// GET/PATCH /api/users/me/client-request-profile (the path predates PH). On UK it also holds the
// settings for receiving clients from the client app; on PH approval only shows a badge for now; on
// KR approval lets a new lawyer in (verify before plan), and shows the badge.

/** Sites with a Lawyer Application. Mirrors LAWYER_COUNTRIES in ilovelawyer-api's
 * constants/lawyer-application.constants.ts. */
export type LawyerCountry = "UK" | "PH" | "KR"

/** The 14 local bar associations (지방변호사회). Mirrors KR_LOCAL_BARS in ilovelawyer-api; the labels
 * are i18n keys (profile: clientRequests.krLocalBars.*). */
export const KR_LOCAL_BARS = [
  "SEOUL",
  "GYEONGGI_BUKBU",
  "INCHEON",
  "GYEONGGI_JUNGANG",
  "GANGWON",
  "CHUNGBUK",
  "DAEJEON",
  "DAEGU",
  "BUSAN",
  "ULSAN",
  "GYEONGNAM",
  "GWANGJU",
  "JEONBUK",
  "JEJU",
] as const
export type KrLocalBar = (typeof KR_LOCAL_BARS)[number]

/** How a Korean lawyer qualified: the bar exam (변호사시험, by round) or the JRTI (사법연수원, by
 * class). Mirrors KR_QUALIFICATION_ROUTES in ilovelawyer-api. */
export const KR_QUALIFICATION_ROUTES = ["BAR_EXAM", "JRTI"] as const
export type KrQualificationRoute = (typeof KR_QUALIFICATION_ROUTES)[number]

/** The API's limits on KR specialties (전문분야): at most 10, each up to 40 characters. */
export const KR_SPECIALTIES_MAX = 10
export const KR_SPECIALTY_MAX_LENGTH = 40

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

export type FeeCurrency = "GBP" | "PHP" | "KRW"
export const FEE_CURRENCY: Record<LawyerCountry, FeeCurrency> = { UK: "GBP", PH: "PHP", KR: "KRW" }
/** Digits after the point in each fee currency: KRW has none, so a fee in won is sent as is. */
export const FEE_DECIMALS: Record<LawyerCountry, 0 | 2> = { UK: 2, PH: 2, KR: 0 }
export const FEE_SYMBOL: Record<LawyerCountry, string> = { UK: "£", PH: "₱", KR: "₩" }

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

export interface KrRegistration {
  country: "KR"
  /** 대한변호사협회 등록번호, digits. Required to submit. */
  registrationNumber: string | null
  /** 소속 지방변호사회. Required to submit. */
  localBar: KrLocalBar | null
  qualificationRoute: KrQualificationRoute | null
  /** The bar exam round (회차) or JRTI class (기수) for that route. */
  qualificationCohort: number | null
  /** Specialist areas registered with the Korean Bar Association (전문분야 등록). */
  specialties: string[]
  /** YYYY-MM-DD. */
  registeredOn: string | null
}

export type Registration = UkRegistration | PhRegistration | KrRegistration

export interface ClientRequestProfile {
  country: LawyerCountry
  registration: Registration
  /** In the site's order. */
  practiceAreas: LawyerPracticeArea[]
  bio: string
  languages: string[]
  /** Minor units: pence on UK, centavos on PH, won on KR (no decimals). */
  firstConsultationFee: { amountMinor: number; currency: FeeCurrency } | null
  /** UK only: the lawyer's own switch for receiving client requests. */
  acceptingRequests: boolean
  /** The organization's switch for this member (set by an owner or admin). */
  enabledByOrganization: boolean
  pausedUntil: string | null
  capacityLimit: number | null
  openEngagements: number
  verification: { status: VerificationStatus; note: string | null; verifiedAt: string | null }
  /** Required fields still empty. UK: regulator, registrationNumber, qualifiedJurisdictions,
   * practiceAreas. PH: rollNumber, ibpChapter, practiceAreas. KR: registrationNumber, localBar,
   * practiceAreas. */
  missing: string[]
}

/** A save. `registration` must be the lawyer's own country's; leave a field out to keep it. */
export interface ClientRequestProfilePatch {
  registration?:
    | ({ country: "UK" } & Partial<Omit<UkRegistration, "country">>)
    | ({ country: "PH" } & Partial<Omit<PhRegistration, "country">>)
    | ({ country: "KR" } & Partial<Omit<KrRegistration, "country">>)
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
