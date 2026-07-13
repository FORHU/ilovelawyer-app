import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { appointmentKeys, noteKeys } from "@/lib/query-keys"

export interface Appointment {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  description: string | null
}

export interface CreateAppointmentPayload {
  title: string
  date: string
  startTime: string
  endTime: string
  description?: string
}

export interface Note {
  id: string
  date: string
  body: string
}

export interface CreateNotePayload {
  date: string
  body: string
}

/** Lists Appointments whose date falls within [from, to] (both yyyy-MM-dd), for the visible calendar month. */
export function useAppointmentsQuery(from: string, to: string) {
  return useQuery({
    queryKey: appointmentKeys.list({ from, to }),
    queryFn: () => apiFetch<Appointment[]>(`/api/appointments?from=${from}&to=${to}`),
  })
}

export function useCreateAppointmentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateAppointmentPayload) =>
      apiFetch<Appointment>("/api/appointments", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() })
    },
  })
}

/** Lists Notes whose date falls within [from, to] (both yyyy-MM-dd), for the visible calendar month. */
export function useNotesQuery(from: string, to: string) {
  return useQuery({
    queryKey: noteKeys.list({ from, to }),
    queryFn: () => apiFetch<Note[]>(`/api/notes?from=${from}&to=${to}`),
  })
}

export function useCreateNoteMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateNotePayload) =>
      apiFetch<Note>("/api/notes", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() })
    },
  })
}
