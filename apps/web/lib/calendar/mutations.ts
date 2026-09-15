import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, parse, isValid } from "date-fns"
import { apiFetch } from "@/lib/fetch"
import { appointmentKeys, caseKeys, noteKeys } from "@/lib/query-keys"

export interface Appointment {
  id: string
  title: string
  date: string
  startTime: string
  /** The backend Event model has no end-time/duration field yet — always null until it ships (see CONTEXT.md pending). */
  endTime: string | null
  description: string | null
  /** Address the appointment confirmation email is also sent to, if one was given. */
  notifyEmail: string | null
  /** Case this appointment is scheduled for, if any — feeds the case timeline. */
  caseId: string | null
}

export interface CreateAppointmentPayload {
  title: string
  date: string
  startTime: string
  /** Collected in the UI but not sent to the backend — no field exists to store it yet. */
  endTime?: string
  description?: string
  /** Optional recipient (e.g. a client) who should also get the confirmation email, in addition to the account owner. */
  notifyEmail?: string
  /** Links this appointment to a case, so it shows up on that case's timeline. */
  caseId?: string
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
  clientEmail: string | null
  caseId: string | null
}

/** Re-formats `value` as zero-padded "HH:mm" if it's a valid time (accepts "9:00" -> "09:00"),
 * or null if it isn't parseable as a time at all (e.g. "9:00 AM", "14h30") — guards against
 * free-text fallback on browsers where <input type="time"> degrades to a text field. */
export function normalizeTimeString(value: string): string | null {
  const parsed = parse(value, "HH:mm", new Date())
  return isValid(parsed) ? format(parsed, "HH:mm") : null
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
    notifyEmail: event.clientEmail,
    caseId: event.caseId ?? null,
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
      // Defensive: the Calendar form (page.tsx's handleSubmit) already validates/normalizes
      // startTime before calling this, so this should be unreachable in practice — but this is
      // an exported hook, not private to that one form, so it shouldn't rely solely on every
      // future caller re-implementing the same check. Without this, an unparseable startTime
      // would reach `new Date(...).toISOString()` below and throw a native RangeError with the
      // raw, untranslated V8 message "Invalid time value" instead of a readable one.
      const normalizedStartTime = normalizeTimeString(payload.startTime)
      if (!normalizedStartTime) throw new Error(`Invalid start time: "${payload.startTime}"`)

      const { event } = await apiFetch<{ event: BackendEvent }>("/api/events", {
        method: "POST",
        body: JSON.stringify({
          title: payload.title,
          dateTime: new Date(`${payload.date}T${normalizedStartTime}`).toISOString(),
          notes: payload.description,
          clientEmail: payload.notifyEmail,
          caseId: payload.caseId,
        }),
      })
      return toAppointment(event)
    },
    onSuccess: (appointment) => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() })
      if (appointment.caseId) {
        queryClient.invalidateQueries({ queryKey: caseKeys.timeline(appointment.caseId) })
      }
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
