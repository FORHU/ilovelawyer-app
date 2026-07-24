import { create } from "zustand"

export interface AuthUser {
  id: string
  username: string
  email: string
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  setAuth: (params: { accessToken: string; user: AuthUser }) => void
  setAccessToken: (accessToken: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,

  setAuth: ({ accessToken, user }) => set({ accessToken, user }),

  setAccessToken: (accessToken) => set({ accessToken }),

  clearAuth: () => set({ accessToken: null, user: null }),
}))
