import { useAuthStore, type Workspace } from "@/lib/store/auth.store"
import type { OrganizationRole } from "@/lib/organizations/queries"
import { useCaseAccessQuery } from "@/lib/cases/sharing"

type CaseEditState = {
  workspace: Workspace
  organization: { role: OrganizationRole; isPersonal: boolean } | null
}

/** Whether the user can change every case in the workspace they're looking at by role alone: the
 * user's own portfolio (their personal workspace, which they own), or OWNER/ADMIN in an
 * organization. It's also who may delete a case (ilovelawyer-api's CaseAccess.assertCanDelete).
 *
 * The API also lets a per-case EDIT/ADMIN grant change a case — which a MANAGER or MEMBER gets on
 * the cases they create — and this can't see that. Where one case is in view use useCanEditCase;
 * the case list returns `canEdit` per row. */
export function canEditCases(state: CaseEditState): boolean {
  // Someone else's portfolio, opened through a read-only share.
  if (state.workspace === "shared") return false
  if (state.workspace === "portfolio") return true
  if (!state.organization) return false
  if (state.organization.isPersonal) return true
  return state.organization.role === "OWNER" || state.organization.role === "ADMIN"
}

export function useCanEditCases(): boolean {
  return useAuthStore(canEditCases)
}

/** Whether the user can edit this one case. The API's answer (GET /access → canEdit) also counts
 * a per-case EDIT/ADMIN grant; until it arrives, falls back to the role rule above. */
export function useCanEditCase(caseId: string | undefined): boolean {
  const byRole = useCanEditCases()
  const { data } = useCaseAccessQuery(caseId)
  return data ? data.canEdit : byRole
}

/** Whether the user can add to or change this case's material — upload a document, add a
 * transcription, regenerate or edit the case mind map. Mirrors the API's
 * CaseAccess.assertCanContribute: anyone who can open an ordinary case may, but a confidential one
 * takes edit access — there "Can view" is read-only. Until GET /access arrives, allows it and
 * leaves a refusal to the API. */
export function useCanContributeToCase(caseId: string | undefined): boolean {
  const { data } = useCaseAccessQuery(caseId)
  if (!data) return true
  // The API's own answer, which also covers a read-only share of a portfolio case.
  if (data.canContribute !== undefined) return data.canContribute
  return !data.confidential || data.canEdit
}
