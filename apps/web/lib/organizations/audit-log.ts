import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import { organizationKeys } from "@/lib/query-keys"

/** One row of the organization's security audit log — see ilovelawyer-api's SecurityAuditEvent
 * (docs/adr/0006-security-audit-log.md). `display` is the row as people read it: names and plain
 * words, never ids, resolved by the API so the table and the PDF export say the same thing. */
export interface SecurityAuditEventRecord {
  id: string
  createdAt: string
  action: string
  outcome: "SUCCESS" | "FAILURE"
  requestId: string | null
  display: {
    /** Who did it — a name, an email for someone since gone, or "No signed-in user". */
    actor: string
    /** What it was done to, e.g. “Affidavit.pdf” in “Smith v Jones”. Empty when nothing was. */
    target: string
    details: string
    ip: string
  }
}

export interface AuditLogPage {
  events: SecurityAuditEventRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
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

/** Matches the API's SECURITY_AUDIT_PAGE_SIZE_MAX — 20 rows a page. */
export const AUDIT_LOG_PAGE_SIZE = 20

/** One page of the log (pages count from 1). Owners and Admins only — the API answers 403 for
 * anyone else. Keeps the previous page on screen while the next one loads, so the table doesn't
 * collapse between pages. */
export function useOrganizationAuditLogQuery(
  organizationId: string,
  filters: AuditLogFilters,
  page: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: organizationKeys.auditLog(organizationId, { ...filters, page }),
    queryFn: () => {
      const params = filterParams(filters)
      params.set("page", String(page))
      params.set("limit", String(AUDIT_LOG_PAGE_SIZE))
      return apiFetch<AuditLogPage>(
        `/api/organizations/${organizationId}/audit-log?${params.toString()}`
      )
    },
    enabled: !!organizationId && (options?.enabled ?? true),
    placeholderData: keepPreviousData,
    // The log only grows, and someone checking it wants what just happened.
    staleTime: 0,
  })
}

/** Downloads the filtered log as a PDF table (the API records the export itself as
 * export.audit_log). */
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
    `audit-log-${new Date().toISOString().slice(0, 10)}.pdf`

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
