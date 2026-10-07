import { useCasesQuery } from "@/lib/cases/mutations"
import { useConsultationsQuery } from "@/lib/chat/mutations"
import { isNewAccount } from "@/lib/onboarding/new-account"

/** Whether the user has an active case in this workspace — the rows the Cases page lists, and so
 * the Workspace and Legal Terminal buttons on them. Undefined until it's known. Creating or
 * archiving a case refreshes it (both invalidate caseKeys.lists()). */
export function useHasActiveCase(enabled = true): boolean | undefined {
  const { data } = useCasesQuery(1, 1, "", "ACTIVE", undefined, { enabled })
  return data ? data.total > 0 : undefined
}

/** A brand-new account: no cases, active or archived, and no consultations. False while any of
 * that is loading or failed to load, so someone with history never sees new-account content
 * flash up. It turns false by itself once a case is created or a first message is sent, as
 * those refresh the same queries. */
export function useIsNewAccount(enabled = true): boolean {
  const active = useCasesQuery(1, 1, "", "ACTIVE", undefined, { enabled })
  const archived = useCasesQuery(1, 1, "", "ARCHIVED", undefined, { enabled })
  const consultations = useConsultationsQuery(undefined, { enabled })
  return isNewAccount(active.data?.total, archived.data?.total, consultations.data?.length)
}

