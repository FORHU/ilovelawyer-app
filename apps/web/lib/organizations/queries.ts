import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { organizationKeys } from "@/lib/query-keys"

export type OrganizationRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER"

export interface OrganizationRecord {
  id: string
  name: string
  slug: string
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
  createdAt: string
  updatedAt: string
  user: { id: string; name: string | null; email: string; username: string }
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
