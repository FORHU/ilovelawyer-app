import { create } from "zustand"

export interface AuthUser {
  id: string
  username: string
  email: string
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  setAuth: (params: { accessToken: string; refreshToken: string; user: AuthUser; remember: boolean }) => void
  updateTokens: (params: { accessToken: string; refreshToken: string }) => void
  clearAuth: () => void
  getRefreshToken: () => string | null
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,

  setAuth: ({ accessToken, refreshToken, user, remember }) => {
    set({ accessToken, user })
    if (remember) {
      localStorage.setItem("refreshToken", refreshToken)
    } else {
      sessionStorage.setItem("refreshToken", refreshToken)
    }
  },

  updateTokens: ({ accessToken, refreshToken }) => {
    set({ accessToken })
    if (localStorage.getItem("refreshToken")) {
      localStorage.setItem("refreshToken", refreshToken)
    } else {
      sessionStorage.setItem("refreshToken", refreshToken)
    }
  },

  clearAuth: () => {
    set({ accessToken: null, user: null })
    localStorage.removeItem("refreshToken")
    sessionStorage.removeItem("refreshToken")
  },

  getRefreshToken: () =>
    localStorage.getItem("refreshToken") ?? sessionStorage.getItem("refreshToken"),
}))
