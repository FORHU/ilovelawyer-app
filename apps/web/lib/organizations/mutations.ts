import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { organizationKeys } from "@/lib/query-keys"
import type { OrganizationRecord, OrganizationMemberRecord, OrganizationRole } from "./queries"

export interface CreateOrganizationPayload {
  name: string
  slug: string
}

export function useCreateOrganizationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateOrganizationPayload) =>
      apiFetch<OrganizationRecord>("/api/organizations", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() })
    },
  })
}

export interface InviteMemberPayload {
  email: string
  role?: OrganizationRole
}

export function useInviteMemberMutation(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: InviteMemberPayload) =>
      apiFetch<OrganizationMemberRecord>(`/api/organizations/${organizationId}/members`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(organizationId) })
    },
  })
}
