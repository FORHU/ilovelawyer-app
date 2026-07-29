import { useAuthStore } from "@/lib/store/auth.store"

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "")

// These all set or read the refreshToken httpOnly cookie, so they're proxied
// same-origin via next.config.ts's rewrites() (see that file for why).
// Every other endpoint — including the streaming chat endpoint — calls the
// API directly, since routing a streamed response through the Next proxy
// buffers the whole thing before relaying it to the browser.
const COOKIE_PROXIED_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/google",
  "/api/auth/verify-otp",
  "/api/auth/reset-password",
  "/api/auth/refresh",
  "/api/auth/logout",
])

function resolveUrl(path: string): string {
  return COOKIE_PROXIED_PATHS.has(path) ? path : `${API_URL}${path}`
}

type FetchOptions = Omit<RequestInit, "credentials"> & { skipAuthRefresh?: boolean }

let refreshPromise: Promise<void> | null = null

export async function attemptRefresh(): Promise<void> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const { setAccessToken, clearAuth } = useAuthStore.getState()

    const res = await fetch(resolveUrl("/api/auth/refresh"), {
      method: "POST",
      credentials: "include",
    })

    if (!res.ok) {
      clearAuth()
      if (typeof window !== "undefined") window.location.href = "/login"
      throw new Error("Session expired")
    }

    const data = await res.json()
    setAccessToken(data.accessToken)
  })().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

function buildHeaders(extra?: HeadersInit, isFormData?: boolean): HeadersInit {
  const { accessToken } = useAuthStore.getState()
  return {
    // Omitted for FormData bodies — the browser must set its own multipart boundary.
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
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
  const isFormData = fetchOptions.body instanceof FormData
  const url = resolveUrl(path)

  const res = await fetch(url, {
    ...fetchOptions,
    credentials: "include",
    headers: buildHeaders(fetchOptions.headers, isFormData),
  })

  if (res.status === 401 && !skipAuthRefresh) {
    await attemptRefresh()

    const retry = await fetch(url, {
      ...fetchOptions,
      credentials: "include",
      headers: buildHeaders(fetchOptions.headers, isFormData),
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
