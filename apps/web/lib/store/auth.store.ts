import { create } from "zustand"
import type { OrganizationRole } from "@/lib/organizations/queries"

export interface AuthUser {
  id: string
  username: string
  email: string
}

export interface ActiveOrganization {
  id: string
  name: string
  slug: string
  role: OrganizationRole
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  organization: ActiveOrganization | null
  setAuth: (params: { accessToken: string; user: AuthUser }) => void
  setAccessToken: (accessToken: string) => void
  setOrganization: (organization: ActiveOrganization | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  organization: null,

  setAuth: ({ accessToken, user }) => set({ accessToken, user }),

  setAccessToken: (accessToken) => set({ accessToken }),

  setOrganization: (organization) => set({ organization }),

  clearAuth: () => set({ accessToken: null, user: null, organization: null }),
}))
