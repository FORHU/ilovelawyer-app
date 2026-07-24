import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { apiFetch } from "@/lib/fetch"
import { appointmentKeys, noteKeys } from "@/lib/query-keys"

export interface Appointment {
  id: string
  title: string
  date: string
  startTime: string
  /** The backend Event model has no end-time/duration field yet — always null until it ships (see CONTEXT.md pending). */
  endTime: string | null
  description: string | null
}

export interface CreateAppointmentPayload {
  title: string
  date: string
  startTime: string
  /** Collected in the UI but not sent to the backend — no field exists to store it yet. */
  endTime?: string
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

interface BackendEvent {
  id: string
  title: string
  dateTime: string
  notes: string | null
}

function toAppointment(event: BackendEvent): Appointment {
  const dt = new Date(event.dateTime)
  return {
    id: event.id,
    title: event.title,
    date: format(dt, "yyyy-MM-dd"),
    startTime: format(dt, "HH:mm"),
    endTime: null,
    description: event.notes,
  }
}

/** Lists Appointments whose date falls within [from, to] (both yyyy-MM-dd), for the visible calendar month. */
export function useAppointmentsQuery(from: string, to: string) {
  return useQuery({
    queryKey: appointmentKeys.list({ from, to }),
    queryFn: async () => {
      const { events } = await apiFetch<{ events: BackendEvent[] }>(
        `/api/events?startRange=${from}T00:00:00.000Z&endRange=${to}T23:59:59.999Z`
      )
      return events.map(toAppointment)
    },
  })
}

export function useCreateAppointmentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateAppointmentPayload) => {
      const { event } = await apiFetch<{ event: BackendEvent }>("/api/events", {
        method: "POST",
        body: JSON.stringify({
          title: payload.title,
          dateTime: new Date(`${payload.date}T${payload.startTime}`).toISOString(),
          notes: payload.description,
        }),
      })
      return toAppointment(event)
    },
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
