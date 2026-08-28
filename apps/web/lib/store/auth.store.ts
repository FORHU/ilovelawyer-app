import { create } from "zustand"
import type { OrganizationRole, PackageSku } from "@/lib/organizations/queries"
import type { TenantCode } from "@/lib/tenant-code/resolve-host"

export interface AuthUser {
  id: string
  username: string
  email: string
  name?: string | null
}

export interface ActiveOrganization {
  id: string
  name: string
  slug: string
  role: OrganizationRole
  packageSku: PackageSku
  tenantCode: TenantCode
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  organization: ActiveOrganization | null
  setAuth: (params: { accessToken: string; user: AuthUser }) => void
  setAccessToken: (accessToken: string) => void
  setOrganization: (organization: ActiveOrganization | null) => void
  updateUser: (patch: Partial<AuthUser>) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  organization: null,

  setAuth: ({ accessToken, user }) => set({ accessToken, user }),

  setAccessToken: (accessToken) => set({ accessToken }),

  setOrganization: (organization) => set({ organization }),

  // Patches the cached user in place — used after a profile edit (name/username)
  // so header/menus relying on this store update immediately, without needing
  // the full re-login/refresh flow that normally populates `user`.
  updateUser: (patch) => set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),

  clearAuth: () => set({ accessToken: null, user: null, organization: null }),
}))
