import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { organizationKeys } from "@/lib/query-keys"
import type { TenantCode } from "@/lib/tenant-code/resolve-host"

export type OrganizationRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER"
export type OrganizationMemberStatus = "PENDING" | "ACCEPTED"

export const PACKAGE_SKUS = ["SOLO", "PROFESSIONAL", "ENTERPRISE"] as const
export type PackageSku = (typeof PACKAGE_SKUS)[number]

export interface OrganizationRecord {
  id: string
  name: string
  slug: string
  packageSku: PackageSku
  /** Persisted, authoritative Tenant — server-resolved at creation from the signup
   * domain, never client-editable. See ilovelawyer-api's Organization.tenantId. */
  tenant: { code: TenantCode }
  /** A skipped-onboarding user's private workspace (see ilovelawyer-api's
   * Organization.isPersonal) — the app treats its owner as having no organization. */
  isPersonal: boolean
  createdAt: string
  updatedAt: string
}

export interface OrganizationWithRole extends OrganizationRecord {
  role: OrganizationRole
}

export interface OrganizationMemberRecord {
  id: string
  organizationId: string
  userId: string
  role: OrganizationRole
  status: OrganizationMemberStatus
  createdAt: string
  updatedAt: string
  /** avatarUrl: null → initials. Only the members list endpoint includes it. */
  user: { id: string; name: string | null; email: string; username: string; avatarUrl?: string | null }
}

/** The caller's own pending invite, or null if they don't have one. */
export interface PendingInviteRecord {
  id: string
  organizationId: string
  role: OrganizationRole
  status: OrganizationMemberStatus
  organization: OrganizationRecord
}

/** A portfolio copy still being made (or that couldn't be) — finished ones are ordinary cases in
 * the portfolio, with `copiedFromCaseId` set. */
export interface CaseCopyRecord {
  id: string
  sourceCaseId: string
  caseName: string
  sourceOrganizationName: string
  status: "PENDING" | "RUNNING" | "FAILED"
  createdAt: string
}

/** The user's portfolio: their personal workspace, reachable from any organization. */
export interface PortfolioRecord extends OrganizationWithRole {
  copies: CaseCopyRecord[]
}

/** Orgs the current user belongs to, each with their role in it. */
export function useOrganizationsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: organizationKeys.lists(),
    queryFn: () => apiFetch<OrganizationWithRole[]>("/api/organizations"),
    enabled: options?.enabled,
  })
}

export function useOrganizationQuery(id: string) {
  return useQuery({
    queryKey: organizationKeys.detail(id),
    queryFn: () => apiFetch<OrganizationRecord>(`/api/organizations/${id}`),
    enabled: !!id,
  })
}

export function useOrganizationMembersQuery(id: string) {
  return useQuery({
    queryKey: organizationKeys.members(id),
    queryFn: () => apiFetch<OrganizationMemberRecord[]>(`/api/organizations/${id}/members`),
    enabled: !!id,
  })
}

/** Polls while copies are still being made, so they turn into cases without a reload. */
export function usePortfolioQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: organizationKeys.portfolio(),
    queryFn: () => apiFetch<PortfolioRecord>("/api/organizations/portfolio"),
    enabled: options?.enabled,
    refetchInterval: (query) => (query.state.data?.copies.some((c) => c.status !== "FAILED") ? 5000 : false),
  })
}

/** The current user's own pending org invite, if any. Unlike most queries here, this
 * deliberately opts out of the app's 5-minute default staleTime — a tab left open from
 * before the invite existed would otherwise sit on a cached "no invite" result and never
 * show the accept/decline prompt until the cache expired or the page was hard-refreshed.
 * staleTime 0 makes it refetch on every mount and on window focus (e.g. tabbing back in
 * after checking the invite email). */
export function useMyInviteQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: organizationKeys.myInvite(),
    queryFn: () => apiFetch<PendingInviteRecord | null>("/api/organizations/invites/me"),
    enabled: options?.enabled,
    staleTime: 0,
  })
}
