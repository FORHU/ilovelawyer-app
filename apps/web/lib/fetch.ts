import { useAuthStore } from "@/lib/store/auth.store"
import { AUTH_PATHS, versioned } from "@/lib/api-version"

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "")

// These read or set the refreshToken httpOnly cookie, so they're proxied
// same-origin via next.config.ts's rewrites() (see that file for why). Without
// this, the cookie set by a direct cross-origin call to the API would be
// scoped to the API's own host, not the frontend's — invisible to the
// same-origin /api/auth/refresh call made on every page load.
// Every other endpoint — including the streaming chat endpoint — calls the
// API directly, since routing a streamed response through the Next proxy
// buffers the whole thing before relaying it to the browser.
// Listed as the pre-version paths call sites actually pass in — versioned() is applied after
// this check, in resolveUrl below.
const COOKIE_PROXIED_PATHS = new Set<string>(AUTH_PATHS)

function resolveUrl(path: string): string {
  const versionedPath = versioned(path)
  return COOKIE_PROXIED_PATHS.has(path) ? versionedPath : `${API_URL}${versionedPath}`
}

type FetchOptions = Omit<RequestInit, "credentials"> & { skipAuthRefresh?: boolean }

let refreshPromise: Promise<string> | null = null

// The refresh token is single-use — the API deletes it as soon as one refresh
// succeeds and issues a new one. Concurrent callers (e.g. React 18 StrictMode's
// double effect invocation in dev, or the auth and protected layouts mounting
// around the same navigation) must share one in-flight request instead of each
// redeeming the cookie separately, or the loser gets a spurious 401.
export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const res = await fetch(resolveUrl("/api/auth/refresh"), {
      method: "POST",
      credentials: "include",
    })

    if (!res.ok) throw new Error("Session expired")

    const data = await res.json()
    useAuthStore.getState().setAccessToken(data.accessToken)
    return data.accessToken as string
  })().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

async function attemptRefresh(): Promise<void> {
  try {
    await refreshAccessToken()
  } catch (err) {
    useAuthStore.getState().clearAuth()
    if (typeof window !== "undefined") window.location.href = "/login"
    throw err
  }
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
  // 204s (e.g. DELETE endpoints) have no body — res.json() would throw on the empty string.
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
