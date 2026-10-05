import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import i18n from "@/lib/i18n/i18n"
import { apiFetch } from "@/lib/fetch"
import { tourKeys } from "@/lib/query-keys"
import { useAuthStore } from "@/lib/store/auth.store"
import type { PageTourTrack } from "@/lib/tour/page-tours"
import type { SampleTourTrack } from "@/lib/sample-case/tours"

export type TourStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "DISMISSED"

/** Mirrors ProductTourSvc's state on the API — where this user is in one tour. */
export interface TourState {
  status: TourStatus
  archetype: string | null
  currentStep: string | null
  doneSteps: string[]
}

/** One per page tour: the page tours, and "studio" / "terminal" (the sample-case tours). Each
 * keeps its own progress — see PRODUCT_TOUR_TRACKS on the API. */
export type TourTrack = PageTourTrack | SampleTourTrack

export function useProductTourQuery(track: TourTrack, enabled = true) {
  const accessToken = useAuthStore((s) => s.accessToken)

  return useQuery({
    queryKey: tourKeys.track(track),
    queryFn: () => apiFetch<TourState>(`/api/users/me/tour/${track}`),
    enabled: !!accessToken && enabled,
    // The tour drives its own cache through useSaveProductTourMutation — a background refetch
    // mid-step could only ever hand back what this tab already wrote.
    staleTime: Infinity,
    // One retry, not the default three with backoff: a first-visit tour waits on this (or on its
    // failure — see useIsFirstVisit), so it shouldn't sit behind ~7s of retries.
    retry: 1,
  })
}

/** Saves the whole tour state. Optimistic: the overlay moves on the instant the user does, and
 * a failed save keeps the local state (the next step's save carries it) with a toast. */
export function useSaveProductTourMutation(track: TourTrack) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (state: TourState) =>
      apiFetch<TourState>(`/api/users/me/tour/${track}`, {
        method: "PUT",
        body: JSON.stringify({
          status: state.status,
          archetype: state.archetype,
          currentStep: state.currentStep,
          doneSteps: state.doneSteps,
        }),
      }),
    onMutate: (state) => {
      queryClient.setQueryData(tourKeys.track(track), state)
    },
    onError: () => {
      // One toast, replaced in place, however many steps fail to save.
      toast.error(i18n.t("toasts.saveFailed", { ns: "tour" }), { id: "tour-save-failed" })
    },
  })
}
