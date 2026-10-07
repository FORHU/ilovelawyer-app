import { create } from "zustand"
import type { OrganizationRole, PackageSku } from "@/lib/organizations/queries"
import type { TenantCode } from "@/lib/tenant-code/resolve-host"

export interface AuthUser {
  id: string
  username: string
  email: string
  name?: string | null
  /** /files/<token> avatar image, or null → initials (see components/user-avatar.tsx). */
  avatarUrl?: string | null
}

export interface ActiveOrganization {
  id: string
  name: string
  slug: string
  role: OrganizationRole
  packageSku: PackageSku
  tenantCode: TenantCode
  /** The private workspace of a user who skipped onboarding — never shown as an organization. */
  isPersonal: boolean
}

/** Which workspace resource requests go to: the user's organization, or their portfolio (their
 * personal workspace, which they reach from any organization — see ilovelawyer-api's
 * OrganizationSvc.getPortfolio). */
export type Workspace = "organization" | "portfolio"

const WORKSPACE_KEY = "ilovelawyer.workspace"

// Per tab, so a reload keeps showing the portfolio but a new tab starts in the organization.
function readWorkspace(): Workspace {
  try {
    return typeof window !== "undefined" && sessionStorage.getItem(WORKSPACE_KEY) === "portfolio" ? "portfolio" : "organization"
  } catch {
    return "organization"
  }
}

function writeWorkspace(workspace: Workspace) {
  try {
    if (workspace === "portfolio") sessionStorage.setItem(WORKSPACE_KEY, workspace)
    else sessionStorage.removeItem(WORKSPACE_KEY)
  } catch {
    // Storage unavailable — the choice just won't survive a reload.
  }
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  organization: ActiveOrganization | null
  /** The user's portfolio, once fetched. Null while they're in their personal workspace itself —
   * then it *is* their organization. */
  portfolio: ActiveOrganization | null
  workspace: Workspace
  setAuth: (params: { accessToken: string; user: AuthUser }) => void
  setAccessToken: (accessToken: string) => void
  setOrganization: (organization: ActiveOrganization | null) => void
  setPortfolio: (portfolio: ActiveOrganization | null) => void
  setWorkspace: (workspace: Workspace) => void
  updateUser: (patch: Partial<AuthUser>) => void
  clearAuth: () => void
}

/** Where resource requests go right now: the portfolio while it's being viewed, else the
 * organization. */
export function activeWorkspaceId(state: Pick<AuthState, "organization" | "portfolio" | "workspace">): string | null {
  if (state.workspace === "portfolio" && state.portfolio) return state.portfolio.id
  return state.organization?.id ?? null
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  organization: null,
  portfolio: null,
  workspace: readWorkspace(),

  setAuth: ({ accessToken, user }) => set({ accessToken, user }),

  setAccessToken: (accessToken) => set({ accessToken }),

  // Moving to a different organization (leaving, switching by invite) also leaves the portfolio
  // view — the portfolio is re-fetched for wherever they are now. A null organization is just
  // the hydration gap after a reload, so it keeps the workspace choice.
  setOrganization: (organization) =>
    set((state) => {
      if (!organization || !state.organization || state.organization.id === organization.id) return { organization }
      writeWorkspace("organization")
      return { organization, portfolio: null, workspace: "organization" }
    }),

  setPortfolio: (portfolio) => set({ portfolio }),

  setWorkspace: (workspace) => {
    writeWorkspace(workspace)
    set({ workspace })
  },

  // Patches the cached user in place — used after a profile edit (name/username)
  // so header/menus relying on this store update immediately, without needing
  // the full re-login/refresh flow that normally populates `user`.
  updateUser: (patch) => set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),

  clearAuth: () => {
    writeWorkspace("organization")
    set({ accessToken: null, user: null, organization: null, portfolio: null, workspace: "organization" })
  },
}))
