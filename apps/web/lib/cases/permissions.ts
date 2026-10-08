import { useAuthStore } from "@/lib/store/auth.store"
import type { OrganizationRole } from "@/lib/organizations/queries"

type CaseEditState = {
  workspace: "organization" | "portfolio"
  organization: { role: OrganizationRole; isPersonal: boolean } | null
}

/** Whether the user can rename, archive, restore or delete cases — and update, archive or delete
 * the documents attached to them — in the workspace they're looking at. Mirrors ilovelawyer-api's
 * CaseAccess.assertCanEdit (#345): the user's own portfolio (their personal workspace, which they
 * own), or OWNER/ADMIN in an organization. MANAGER and MEMBER can't, so the actions are hidden
 * rather than left to 404.
 *
 * The API also accepts an explicit per-case EDIT/ADMIN grant, which this doesn't see: a member
 * holding one loses the buttons for that case. Grants can't be made from the app yet (#347). */
export function canEditCases(state: CaseEditState): boolean {
  if (state.workspace === "portfolio") return true
  if (!state.organization) return false
  if (state.organization.isPersonal) return true
  return state.organization.role === "OWNER" || state.organization.role === "ADMIN"
}

export function useCanEditCases(): boolean {
  return useAuthStore(canEditCases)
}
