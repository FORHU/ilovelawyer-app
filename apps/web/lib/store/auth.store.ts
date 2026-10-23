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
  /** The lawyer's own workspace (see ownWorkspace) — never shown as an organization. */
  isPersonal: boolean
}

/** The `id` of a lawyer's own workspace. It has no organization (ilovelawyer-api's
 * docs/adr/0022): its requests carry no X-Organization-Id, and nothing is created for it. */
export const OWN_WORKSPACE_ID = "own"

/** A lawyer's own workspace ("My work"): a solo lawyer's only one, and for a firm's lawyer their
 * portfolio — the cases they made solo and the copies they keep of firms they've left. Shaped like
 * an organization so the pages that show the current workspace need no second type. */
export function ownWorkspace(tenantCode: TenantCode, name: string): ActiveOrganization {
  return { id: OWN_WORKSPACE_ID, name, slug: "", role: "OWNER", packageSku: "SOLO", tenantCode, isPersonal: true }
}

/** The X-Organization-Id for a workspace: none for the lawyer's own. */
function headerIdOf(workspace: ActiveOrganization | null | undefined): string | null {
  return workspace && workspace.id !== OWN_WORKSPACE_ID ? workspace.id : null
}

/** Which workspace resource requests go to: the user's firm, their portfolio (their own
 * workspace, which they reach from any firm — see ilovelawyer-api's OrganizationSvc.getPortfolio),
 * or someone else's portfolio while opening a case they shared with this user, read-only (see
 * SharedWorkspaceGuard). A solo lawyer's `organization` is their own workspace. */
export type Workspace = "organization" | "portfolio" | "shared"

/** Someone else's portfolio, reached through a case they shared with this user. */
export interface SharedWorkspace {
  /** Its X-Organization-Id: `user:<owner id>` for a lawyer's own workspace. */
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
  /** The user's own workspace while they're in a firm, once fetched. Null for a solo lawyer — their
   * own workspace is then `organization`. */
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

/** The X-Organization-Id resource requests carry right now: the shared portfolio's while one is
 * open, none for the lawyer's own workspace (the portfolio, or a solo lawyer's only one), else the
 * firm's. */
export function activeWorkspaceId(state: Pick<AuthState, "organization" | "portfolio" | "workspace" | "shared">): string | null {
  if (state.workspace === "shared" && state.shared) return state.shared.id
  if (state.workspace === "portfolio" && state.portfolio) return null
  return headerIdOf(state.organization)
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
  // view — the portfolio is re-fetched for wherever they are now. Landing in their own workspace
  // (solo: leaving a firm, or choosing Solo) leaves it too, since that workspace now *is* their
  // only one. A null organization is just the hydration gap after a reload, so it keeps the
  // workspace choice.
  setOrganization: (organization) =>
    set((state) => {
      const switched = !!organization && ((!!state.organization && state.organization.id !== organization.id) || organization.isPersonal)
      if (!switched) return { organization }
      if (state.workspace !== "shared") writeWorkspace("organization")
      return state.workspace === "shared"
        ? { organization, portfolio: null }
        : { organization, portfolio: null, workspace: "organization", shared: null }
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
