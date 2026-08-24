import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { organizationKeys } from "@/lib/query-keys"

export type OrganizationRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER"
export type OrganizationMemberStatus = "PENDING" | "ACCEPTED"

export const PACKAGE_SKUS = ["SOLO", "PROFESSIONAL", "ENTERPRISE"] as const
export type PackageSku = (typeof PACKAGE_SKUS)[number]

export interface OrganizationRecord {
  id: string
  name: string
  slug: string
  packageSku: PackageSku
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
  user: { id: string; name: string | null; email: string; username: string }
}

/** The caller's own pending invite, or null if they don't have one. */
export interface PendingInviteRecord {
  id: string
  organizationId: string
  role: OrganizationRole
  status: OrganizationMemberStatus
  organization: OrganizationRecord
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
