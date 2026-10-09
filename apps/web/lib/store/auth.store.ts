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

/** Which workspace resource requests go to: the user's organization, their portfolio (their
 * personal workspace, which they reach from any organization — see ilovelawyer-api's
 * OrganizationSvc.getPortfolio), or someone else's portfolio while opening a case they shared
 * with this user, read-only (see SharedWorkspaceGuard). */
export type Workspace = "organization" | "portfolio" | "shared"

/** Someone else's portfolio, reached through a case they shared with this user. */
export interface SharedWorkspace {
  id: string
  ownerName: string
}

/** The only pages a read-only share opens: the case page (its Overview, and a read-only
 * Workspace of its documents — see SharedCaseWorkspace) and its Terminal, with the Terminal's
 * canvas and document sub-pages. Not the case list itself. */
export const SHARED_WORKSPACE_PATH = /^\/homepage\/(case-portfolio|terminal)\/[^/]+(\/|$)/

const WORKSPACE_KEY = "ilovelawyer.workspace"
const SHARED_KEY = "ilovelawyer.sharedWorkspace"

function readShared(): SharedWorkspace | null {
  try {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(SHARED_KEY) : null
    const parsed = raw ? (JSON.parse(raw) as Partial<SharedWorkspace>) : null
    return parsed && typeof parsed.id === "string" && typeof parsed.ownerName === "string" ? { id: parsed.id, ownerName: parsed.ownerName } : null
  } catch {
    return null
  }
}

// Per tab, so a reload keeps showing the portfolio but a new tab starts in the organization.
function readWorkspace(): Workspace {
  try {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem(WORKSPACE_KEY) : null
    if (stored === "portfolio") return "portfolio"
    // Only back into someone else's portfolio on a page a share reaches (a reload of the Terminal).
    if (stored === "shared" && readShared() && SHARED_WORKSPACE_PATH.test(window.location.pathname)) return "shared"
    return "organization"
  } catch {
    return "organization"
  }
}

function writeWorkspace(workspace: Workspace, shared: SharedWorkspace | null = null) {
  try {
    if (workspace === "organization") sessionStorage.removeItem(WORKSPACE_KEY)
    else sessionStorage.setItem(WORKSPACE_KEY, workspace)
    if (workspace === "shared" && shared) sessionStorage.setItem(SHARED_KEY, JSON.stringify(shared))
    else sessionStorage.removeItem(SHARED_KEY)
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
  /** Set while `workspace` is "shared". */
  shared: SharedWorkspace | null
  setAuth: (params: { accessToken: string; user: AuthUser }) => void
  setAccessToken: (accessToken: string) => void
  setOrganization: (organization: ActiveOrganization | null) => void
  setPortfolio: (portfolio: ActiveOrganization | null) => void
  setWorkspace: (workspace: Exclude<Workspace, "shared">) => void
  enterSharedWorkspace: (shared: SharedWorkspace) => void
  updateUser: (patch: Partial<AuthUser>) => void
  clearAuth: () => void
}

/** Where resource requests go right now: the portfolio while it's being viewed, else the
 * organization. */
export function activeWorkspaceId(state: Pick<AuthState, "organization" | "portfolio" | "workspace" | "shared">): string | null {
  if (state.workspace === "shared" && state.shared) return state.shared.id
  if (state.workspace === "portfolio" && state.portfolio) return state.portfolio.id
  return state.organization?.id ?? null
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  organization: null,
  portfolio: null,
  workspace: readWorkspace(),
  shared: readShared(),

  setAuth: ({ accessToken, user }) => set({ accessToken, user }),

  setAccessToken: (accessToken) => set({ accessToken }),

  // Moving to a different organization (leaving, switching by invite) also leaves the portfolio
  // view — the portfolio is re-fetched for wherever they are now. A null organization is just
  // the hydration gap after a reload, so it keeps the workspace choice.
  setOrganization: (organization) =>
    set((state) => {
      if (!organization || !state.organization || state.organization.id === organization.id) return { organization }
      writeWorkspace("organization")
      return { organization, portfolio: null, workspace: "organization", shared: null }
    }),

  setPortfolio: (portfolio) => set({ portfolio }),

  setWorkspace: (workspace) => {
    writeWorkspace(workspace)
    set({ workspace, shared: null })
  },

  enterSharedWorkspace: (shared) => {
    writeWorkspace("shared", shared)
    set({ workspace: "shared", shared })
  },

  // Patches the cached user in place — used after a profile edit (name/username)
  // so header/menus relying on this store update immediately, without needing
  // the full re-login/refresh flow that normally populates `user`.
  updateUser: (patch) => set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),

  clearAuth: () => {
    writeWorkspace("organization")
    set({ accessToken: null, user: null, organization: null, portfolio: null, workspace: "organization", shared: null })
  },
}))
