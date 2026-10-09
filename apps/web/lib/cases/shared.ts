import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import type { Socket } from "socket.io-client"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import { caseKeys, sharedCaseKeys } from "@/lib/query-keys"
import { useAuthStore } from "@/lib/store/auth.store"

/** A portfolio case someone shared with this user, read-only — see ilovelawyer-api's
 * CaseShareSvc. `organizationId` is the owner's portfolio, the workspace the case opens in. */
export interface SharedCase {
  id: string
  caseName: string
  updatedAt: string
  organizationId: string
  sharedAt: string | null
  parties: { name: string }[]
  owner: { id: string; name: string | null; email: string; username: string; avatarUrl: string | null } | null
}

/** Whether this tab is reading someone else's portfolio case through a read-only share. */
export function useIsSharedWorkspace() {
  return useAuthStore((s) => s.workspace === "shared")
}

export function ownerNameOf(sharedCase: Pick<SharedCase, "owner">) {
  return sharedCase.owner?.name?.trim() || sharedCase.owner?.username || ""
}

/** Needs no workspace: these live in other people's portfolios, whichever workspace is open. */
export function useSharedCasesQuery() {
  return useQuery({
    queryKey: sharedCaseKeys.list(),
    queryFn: () => apiFetch<SharedCase[]>("/api/shared-cases"),
  })
}

/** Drops a share from this user's list. There's no accept step, so this is how they decline one. */
export function useLeaveSharedCaseMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (caseId: string) => {
      // 204 No Content — apiFetch would try to parse it as JSON.
      await apiFetchRaw(`/api/shared-cases/${caseId}`, { method: "DELETE" })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sharedCaseKeys.all }),
  })
}

/** Pushed by the API (CaseShareSvc) to the recipient when a share is made or ends — by the owner
 * stopping it, or the recipient removing it from their list. */
export const SHARED_CASES_CHANGED = "shared-cases:changed"

export interface SharedCasesChangedPayload {
  caseId: string
  shared: boolean
}

type ShareSocket = Pick<Socket, "on" | "off">

/** Keeps "Shared with me" live, and a tab that has a case open in its owner's portfolio honest
 * when that share ends: the case is refetched, the API now refuses it, and the case page or
 * Terminal swaps to CaseUnavailable ("isn't shared with you anymore"). The API has already taken
 * this user's sockets out of the case's live room by then. Returns the unregister function. */
export function registerShareSocketHandlers(socket: ShareSocket, queryClient: QueryClient): () => void {
  const handleChanged = ({ caseId, shared }: SharedCasesChangedPayload) => {
    queryClient.invalidateQueries({ queryKey: sharedCaseKeys.all })
    if (shared) return
    queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) })
    queryClient.invalidateQueries({ queryKey: caseKeys.access(caseId) })
  }
  // A share made or ended while disconnected: catch up on reconnect.
  const handleConnect = () => queryClient.invalidateQueries({ queryKey: sharedCaseKeys.all })
  socket.on(SHARED_CASES_CHANGED, handleChanged)
  socket.on("connect", handleConnect)
  return () => {
    socket.off(SHARED_CASES_CHANGED, handleChanged)
    socket.off("connect", handleConnect)
  }
}
