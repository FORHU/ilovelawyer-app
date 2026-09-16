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
  /** Minutes before dateTime the backend should send a reminder, if a lead time was set. */
  reminderLeadMinutes: number | null
  /** "pending" (default), "cancelled", "completed", or a Google-sync-computed status
   * ("confirmed" / "tentative" / "denied"). */
  status: string
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
  /** Minutes before the appointment to send a reminder (e.g. 1440 = 1 day). Omitted means no reminder. */
  reminderLeadMinutes?: number
}

export interface UpdateAppointmentPayload {
  id: string
  title?: string
  /** Both required together to change the appointment's date/time. */
  date?: string
  startTime?: string
  description?: string
  notifyEmail?: string
  /** Empty string clears the linked case. */
  caseId?: string
  /** null clears the reminder. */
  reminderLeadMinutes?: number | null
  status?: string
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
  reminderLeadMinutes: number | null
  status: string
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
    reminderLeadMinutes: event.reminderLeadMinutes ?? null,
    status: event.status,
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
          reminderLeadMinutes: payload.reminderLeadMinutes,
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

/** Edits an appointment's fields and/or status (cancel/complete/restore) — the PUT endpoint
 * only returns { success: true }, so callers rely on the appointments-list invalidation below
 * rather than an optimistic update from the response. */
export function useUpdateAppointmentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UpdateAppointmentPayload) => {
      const body: Record<string, unknown> = {}
      if (payload.title !== undefined) body.title = payload.title
      if (payload.date && payload.startTime) {
        body.dateTime = new Date(`${payload.date}T${payload.startTime}`).toISOString()
      }
      if (payload.description !== undefined) body.notes = payload.description
      if (payload.notifyEmail !== undefined) body.clientEmail = payload.notifyEmail
      if (payload.caseId !== undefined) body.caseId = payload.caseId || null
      if (payload.reminderLeadMinutes !== undefined) body.reminderLeadMinutes = payload.reminderLeadMinutes
      if (payload.status !== undefined) body.status = payload.status

      await apiFetch<{ success: boolean }>(`/api/events/${payload.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      })
      return payload
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() })
      if (payload.caseId) {
        queryClient.invalidateQueries({ queryKey: caseKeys.timeline(payload.caseId) })
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
