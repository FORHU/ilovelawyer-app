import { isFeatureEnabled } from "@/config/tenant-codes/capabilities"
import type { TenantCode } from "@/lib/tenant-code/resolve-host"
import type { ClientRequestProfile } from "./profile"

/** Whether the lawyer can open their client requests, and if not, why. Mirrors the API's own
 * refusals on /api/client-requests (ClientRequestLawyerSvc.assertVerifiedLawyer): UK only
 * (NOT_UK_TENANT), and only once the Lawyer Application is verified (LAWYER_NOT_VERIFIED). Checked
 * up front so the page explains it instead of calling the API for a 403. */
export type ClientRequestAccess = "ready" | "not-available" | "incomplete" | "pending" | "rejected"

/** null while the lawyer's profile is still loading on a site that has client requests. */
export function clientRequestAccess(
  tenantCode: TenantCode | null | undefined,
  profile: Pick<ClientRequestProfile, "verification"> | undefined
): ClientRequestAccess | null {
  if (!isFeatureEnabled(tenantCode, "clientRequests")) return "not-available"
  if (!profile) return null
  switch (profile.verification.status) {
    case "VERIFIED":
      return "ready"
    case "PENDING":
      return "pending"
    case "REJECTED":
      return "rejected"
    case "UNSUBMITTED":
      return "incomplete"
  }
}

/** An apiFetch rejection that was the API refusing (4xx): retrying it can't change the answer. */
export function isClientError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === "number" && status >= 400 && status < 500
}
