import { useInfiniteQuery } from "@tanstack/react-query"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import { organizationKeys } from "@/lib/query-keys"

/** One row of the organization's security audit log — see ilovelawyer-api's SecurityAuditEvent
 * (docs/adr/0006-security-audit-log.md). Rows carry ids and counts, never case content. */
export interface SecurityAuditEventRecord {
  id: string
  createdAt: string
  action: string
  outcome: "SUCCESS" | "FAILURE"
  organizationId: string | null
  actorId: string | null
  actorEmail: string | null
  targetType: string | null
  targetId: string | null
  caseId: string | null
  ip: string | null
  userAgent: string | null
  requestId: string | null
  payload: Record<string, unknown> | null
}

interface AuditLogPage {
  events: SecurityAuditEventRecord[]
  nextCursor: string | null
}

/** What the log can be narrowed to. `action` is an exact action or a group prefix ("auth."); `to`
 * is exclusive. Dates are ISO strings. */
export interface AuditLogFilters {
  action?: string
  outcome?: "FAILURE"
  from?: string
  to?: string
}

function filterParams(filters: AuditLogFilters): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  return params
}

const PAGE_SIZE = 50

/** Owners and Admins only — the API answers 403 for anyone else. */
export function useOrganizationAuditLogQuery(
  organizationId: string,
  filters: AuditLogFilters,
  options?: { enabled?: boolean }
) {
  return useInfiniteQuery({
    queryKey: organizationKeys.auditLog(organizationId, filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const params = filterParams(filters)
      params.set("limit", String(PAGE_SIZE))
      if (pageParam) params.set("cursor", pageParam)
      return apiFetch<AuditLogPage>(
        `/api/organizations/${organizationId}/audit-log?${params.toString()}`
      )
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!organizationId && (options?.enabled ?? true),
    // The log only grows, and someone checking it wants what just happened.
    staleTime: 0,
  })
}

/** Downloads the filtered log as CSV (the API records the export itself as export.audit_log). */
export async function downloadOrganizationAuditLog(
  organizationId: string,
  filters: AuditLogFilters
): Promise<void> {
  const params = filterParams(filters)
  const res = await apiFetchRaw(
    `/api/organizations/${organizationId}/audit-log/export?${params.toString()}`
  )
  const blob = await res.blob()
  const disposition = res.headers.get("content-disposition") ?? ""
  const filename =
    /filename="([^"]+)"/.exec(disposition)?.[1] ??
    `audit-log-${new Date().toISOString().slice(0, 10)}.csv`

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
