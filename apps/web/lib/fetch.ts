import { useAuthStore } from "@/lib/store/auth.store"

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "")

type FetchOptions = Omit<RequestInit, "credentials"> & { skipAuthRefresh?: boolean }

let refreshPromise: Promise<void> | null = null

async function attemptRefresh(): Promise<void> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const { getRefreshToken, updateTokens, clearAuth } = useAuthStore.getState()
    const refreshToken = getRefreshToken()

    if (!refreshToken) {
      clearAuth()
      if (typeof window !== "undefined") window.location.href = "/login"
      throw new Error("No refresh token available")
    }

    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) {
      clearAuth()
      if (typeof window !== "undefined") window.location.href = "/login"
      throw new Error("Session expired")
    }

    const data = await res.json()
    updateTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
  })().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

function buildHeaders(extra?: HeadersInit): HeadersInit {
  const { accessToken } = useAuthStore.getState()
  return {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(extra as Record<string, string>),
  }
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return
  const error = await res.json().catch(() => ({ message: res.statusText }))
  throw Object.assign(new Error(error.message ?? "Request failed"), { status: res.status })
}

/** Like apiFetch, but returns the raw Response instead of parsing JSON — for streamed bodies. */
export async function apiFetchRaw(path: string, options?: FetchOptions): Promise<Response> {
  const { skipAuthRefresh, ...fetchOptions } = options ?? {}

  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    credentials: "include",
    headers: buildHeaders(fetchOptions.headers),
  })

  if (res.status === 401 && !skipAuthRefresh) {
    await attemptRefresh()

    const retry = await fetch(`${BASE_URL}${path}`, {
      ...fetchOptions,
      credentials: "include",
      headers: buildHeaders(fetchOptions.headers),
    })

    await throwIfNotOk(retry)
    return retry
  }

  await throwIfNotOk(res)
  return res
}

export async function apiFetch<T>(path: string, options?: FetchOptions): Promise<T> {
  const res = await apiFetchRaw(path, options)
  return res.json() as Promise<T>
}
