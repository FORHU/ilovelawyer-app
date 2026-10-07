import { activeWorkspaceId, useAuthStore } from "@/lib/store/auth.store"
import { AUTH_PATHS, versioned } from "@/lib/api-version"

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "")

/** Absolute API origin, for the few places that need a real URL rather than an `apiFetch` call
 * — e.g. an <iframe src> the browser loads directly (no Authorization header possible). */
export const API_BASE_URL = API_URL

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

// Non-httpOnly companion to the refreshToken cookie (see refreshTokenCookie.ts on the API):
// carries no secret, just a "1" flag readable via document.cookie, mirroring refreshToken's
// lifetime. Lets callers skip a silent refresh that's guaranteed to 401 when no session
// cookie could possibly exist (e.g. a first-time visitor landing on /login).
export function hasSessionHint(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie.split("; ").some((c) => c === "hasSession=1")
}

let refreshPromise: Promise<string> | null = null

// The refresh token is single-use — the API deletes it as soon as one refresh
// succeeds and issues a new one. Concurrent callers (e.g. React 18 StrictMode's
// double effect invocation in dev, or the auth and protected layouts mounting
// around the same navigation) must share one in-flight request instead of each
// redeeming the cookie separately, or the loser gets a spurious 401.
// The same race exists across tabs, which refreshPromise can't see: the access token lives only
// in memory, so every new tab (e.g. several chat citations opened into the Library at once)
// redeems the shared cookie on load. A Web Lock serializes those — the tab that waits then
// sends the cookie its predecessor just rotated, instead of the one it already spent.
const REFRESH_LOCK = "ilovelawyer-auth-refresh"

async function redeemRefreshCookie(): Promise<string> {
  const res = await fetch(resolveUrl("/api/auth/refresh"), {
    method: "POST",
    credentials: "include",
  })

  if (!res.ok) throw new Error("Session expired")

  const data = await res.json()
  useAuthStore.getState().setAccessToken(data.accessToken)
  return data.accessToken as string
}

export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise

  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined
  // lib.dom types request() as Promise<callback's return type> without unwrapping it; at runtime
  // it resolves with the callback's resolved value, i.e. the token.
  const redeemed = locks
    ? (locks.request(REFRESH_LOCK, redeemRefreshCookie) as unknown as Promise<string>)
    : redeemRefreshCookie()
  refreshPromise = redeemed.finally(() => {
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
  const state = useAuthStore.getState()
  const { accessToken } = state
  const workspaceId = activeWorkspaceId(state)
  return {
    // Omitted for FormData bodies — the browser must set its own multipart boundary.
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    // Required by resolve-organization.middleware.ts on resource routes (cases, chat,
    // events, bookmarks, transcriptions, documents) — see
    // docs/organization-feature-frontend-handoff.md §2. The portfolio, while it's being viewed.
    ...(workspaceId ? { "X-Organization-Id": workspaceId } : {}),
    ...(extra as Record<string, string>),
  }
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return
  const error = await res.json().catch(() => ({ message: res.statusText }))
  // `code` is the API's optional machine-readable reason (HttpError.code), e.g. a mind map
  // expand refused with MAX_NODES — absent on most errors. `body` is the whole parsed error
  // object, for the rarer case a caller wants a field beyond message/code (e.g. the events
  // endpoint's 422 `blockers` array) without every future field needing its own plumbing here.
  throw Object.assign(new Error(error.message ?? "Request failed"), { status: res.status, code: error.code, body: error })
}

/** Whether an apiFetch rejection was the API answering 404 — the thing asked for doesn't exist. */
export function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { status?: unknown }).status === 404
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
