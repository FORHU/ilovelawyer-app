import { useAuthStore } from "@/lib/store/auth.store"

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "")

type FetchOptions = Omit<RequestInit, "credentials"> & { skipAuthRefresh?: boolean }

let refreshPromise: Promise<void> | null = null

async function attemptRefresh(): Promise<void> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const { setAccessToken, clearAuth } = useAuthStore.getState()

    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
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

  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    credentials: "include",
    headers: buildHeaders(fetchOptions.headers, isFormData),
  })

  if (res.status === 401 && !skipAuthRefresh) {
    await attemptRefresh()

    const retry = await fetch(`${BASE_URL}${path}`, {
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
