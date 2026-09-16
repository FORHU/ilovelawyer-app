"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Calendar } from "@workspace/ui/components/calendar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import CustomSelect from "@/components/ui/custom-select";
import { cn } from "@workspace/ui/lib/utils";
import type { DayButton } from "react-day-picker";
import { format, isBefore, isSameDay, isSameMonth, parse, startOfDay, startOfMonth, endOfMonth } from "date-fns";
import { AlertCircle, Ban, Clock, Pencil, RotateCw, StickyNote, Trash2, Undo2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useAppointmentsQuery,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
  useNotesQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
  normalizeTimeString,
} from "@/lib/calendar/mutations";
import type { Appointment } from "@/lib/calendar/mutations";
import { useCasesQuery } from "@/lib/cases/mutations";

// Day cells have a fixed height (see CalendarDayCell) — 1 visible item plus an overflow
// label is what reliably fits without the cell growing or clipping mid-line.
const MAX_VISIBLE_PER_DAY = 1;

// Keeps a single pasted wall of text from ballooning the day's appointment/note list —
// the list container also scrolls (see the CardFooter <ul>) once content exceeds it.
const DESCRIPTION_MAX_LENGTH = 500;
const NOTE_MAX_LENGTH = 500;

function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function isPastDay(date: Date): boolean {
  return isBefore(startOfDay(date), startOfDay(new Date()));
}

/** An appointment reads as "Done" once its own date/time has passed — not a status the
 * lawyer sets manually, so this is computed fresh on every render rather than stored. */
function isAppointmentPast(appt: { date: string; startTime: string }): boolean {
  return new Date(`${appt.date}T${appt.startTime}`) < new Date();
}

function formatTime12h(time: string): string {
  return format(parse(time, "HH:mm", new Date()), "h:mm a");
}

/* ==========================================
   MONTH GRID DAY CELL (appointments)
   ========================================== */
type DayItem = { id: string; title: string; time: string | null; sortKey: string; kind: "appointment" | "note"; cancelled?: boolean };
type DayItems = { visible: DayItem[]; overflowCount: number };

const CalendarItemsContext = React.createContext<{
  itemsByDate: Map<string, DayItems>;
  selectedDate: Date | undefined;
  onSelectDay: (date: Date) => void;
} | null>(null);

function CalendarDayCell({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const { t } = useTranslation("calendar");
  const ctx = React.useContext(CalendarItemsContext);
  const itemsByDate = ctx?.itemsByDate;
  const selectedDate = ctx?.selectedDate;
  const onSelectDay = ctx?.onSelectDay ?? (() => {});

  const dayItems = itemsByDate?.get(toDateKey(day.date));
  const isSelected = selectedDate ? isSameDay(day.date, selectedDate) : false;
  const isPast = !!modifiers.past && !modifiers.today;
  // A day-wide "view or add appointments" tooltip would overlap the per-item ones below once
  // the cell has content, so it's only shown for empty cells.
  const hasItems = !!dayItems && (dayItems.visible.length > 0 || dayItems.overflowCount > 0);

  const button = (
    <button
      type="button"
      onClick={() => onSelectDay(day.date)}
      disabled={props.disabled}
      className={cn(
        "flex w-full min-w-0 flex-col items-start gap-1 overflow-hidden rounded-lg border p-1.5 text-left align-top text-card-foreground transition-colors hover:bg-accent dark:hover:bg-overlay-hover disabled:pointer-events-none disabled:opacity-40",
        modifiers.outside ? "border-border/50 text-muted-foreground" : "border-border",
        isPast && !modifiers.outside && "bg-muted/30",
        isSelected && "border-primary bg-primary/10",
        className
      )}
      // Inline, not a Tailwind class: guarantees a hard cap regardless of class-merge order
      // or stale-CSS-cache quirks — a day with many appointments must never grow this box.
      style={{ height: 92, maxHeight: 92, overflow: "hidden" }}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium",
          modifiers.today && "bg-primary font-bold text-primary-foreground",
          isPast && "bg-muted text-muted-foreground"
        )}
      >
        {day.date.getDate()}
      </span>
      <div className="flex w-full min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
        {dayItems?.visible.map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight",
                  item.cancelled
                    ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                    : item.kind === "note"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300"
                )}
              >
                {item.kind === "note" ? (
                  <StickyNote className="size-2.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Clock className="size-2.5 shrink-0" aria-hidden="true" />
                )}
                <span className={cn("min-w-0 truncate", item.cancelled && "line-through")}>
                  {item.time ? `${item.time} ` : ""}
                  {item.title}
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent className="h-[104px] w-64 max-w-64 px-3 py-2 text-left">
              <div className="flex h-full items-start gap-2">
                <span
                  className={cn(
                    "mt-1 size-2 shrink-0 rounded-full",
                    item.cancelled ? "bg-red-400" : item.kind === "note" ? "bg-amber-400" : "bg-blue-400"
                  )}
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  {/* Fixed height (not just a line-clamp max) so a one-word title and a
                      three-line title produce the same popout size — never grows/shrinks
                      with content, same as the fixed-size day cell it comes from. */}
                  <p
                    className={cn(
                      "line-clamp-3 h-12 overflow-hidden text-xs leading-snug font-semibold break-words",
                      item.cancelled && "line-through"
                    )}
                  >
                    {item.title}
                  </p>
                  {/* Same fixed-block approach as the title — 2 lines reserved so the full
                      date/time/status text is readable instead of getting ellipsis-cut. */}
                  <p className="mt-1 line-clamp-2 h-8 overflow-hidden text-[11px] break-words opacity-80">
                    {format(day.date, "EEEE, MMM d")}
                    {item.time ? ` · ${item.time}` : ""}
                    {item.cancelled ? ` · ${t("statusCancelled")}` : ""}
                  </p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
        {dayItems && dayItems.overflowCount > 0 && (
          <span className="text-[10px] text-muted-foreground">{t("overflowMore", { count: dayItems.overflowCount })}</span>
        )}
      </div>
    </button>
  );

  if (hasItems) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{isPast ? t("pastDate.tooltip", { date: format(day.date, "MMM d") }) : `View or add appointments on ${format(day.date, "MMM d")}`}</TooltipContent>
    </Tooltip>
  );
}

/* ==========================================
   DISMISSIBLE INLINE ERROR BANNER
   ========================================== */
function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const { t } = useTranslation("calendar");
  return (
    <div className="flex items-center gap-3 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-red-800 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300" role="alert">
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
      <p className="text-xs">{message}</p>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={onDismiss} className="ml-auto cursor-pointer text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100" aria-label="Dismiss error">
            <X className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Dismiss error</TooltipContent>
      </Tooltip>
    </div>
  );
}

/* ==========================================
   PLANNER PANEL (mini calendar + add form + selected day list)
   ========================================== */
function PlannerPanel({
  selectedDate,
  currentMonth,
  onSelectDay,
  onMonthChange,
  selectedAppointments,
  selectedNotes,
  initialCaseId,
  datesWithItems,
}: {
  selectedDate: Date | undefined;
  currentMonth: Date;
  onSelectDay: (date: Date) => void;
  onMonthChange: (month: Date) => void;
  selectedAppointments: Appointment[];
  selectedNotes: { id: string; body: string }[];
  initialCaseId: string | null;
  datesWithItems: Set<string>;
}) {
  const [entryType, setEntryType] = React.useState<"appointment" | "note">("appointment");
  const [title, setTitle] = React.useState("");
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [notifyEmail, setNotifyEmail] = React.useState("");
  const [caseId, setCaseId] = React.useState(initialCaseId ?? "");
  const [reminderLeadMinutes, setReminderLeadMinutes] = React.useState("");
  const [noteBody, setNoteBody] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const { t } = useTranslation("calendar");

  const createAppointment = useCreateAppointmentMutation();
  const updateAppointment = useUpdateAppointmentMutation();
  const createNote = useCreateNoteMutation();
  const updateNote = useUpdateNoteMutation();
  const deleteNote = useDeleteNoteMutation();
  const isSubmitting =
    createAppointment.isPending || createNote.isPending || updateAppointment.isPending || updateNote.isPending;
  const casesQuery = useCasesQuery(1, 100);
  const cases = casesQuery.data?.data ?? [];
  const isPastSelected = selectedDate ? isPastDay(selectedDate) : false;

  function resetAppointmentFields() {
    setTitle("");
    setStartTime("");
    setEndTime("");
    setDescription("");
    setNotifyEmail("");
    setReminderLeadMinutes("");
    setEditingId(null);
  }

  function resetNoteFields() {
    setNoteBody("");
    setEditingNoteId(null);
  }

  function startEdit(appt: Appointment) {
    setFormError(null);
    setEntryType("appointment");
    resetNoteFields();
    setEditingId(appt.id);
    setTitle(appt.title);
    setStartTime(appt.startTime);
    setEndTime(appt.endTime ?? "");
    setDescription((appt.description ?? "").slice(0, DESCRIPTION_MAX_LENGTH));
    setNotifyEmail(appt.notifyEmail ?? "");
    setCaseId(appt.caseId ?? "");
    setReminderLeadMinutes(appt.reminderLeadMinutes ? String(appt.reminderLeadMinutes) : "");
  }

  function startEditNote(note: { id: string; body: string }) {
    setFormError(null);
    setEntryType("note");
    resetAppointmentFields();
    setEditingNoteId(note.id);
    setNoteBody(note.body.slice(0, NOTE_MAX_LENGTH));
  }

  async function setAppointmentStatus(appt: Appointment, status: string) {
    setFormError(null);
    try {
      await updateAppointment.mutateAsync({ id: appt.id, status, caseId: appt.caseId ?? undefined });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("errors.appointmentSaveFailed"));
    }
  }

  async function handleDeleteNote(note: { id: string; body: string }) {
    setFormError(null);
    if (!window.confirm(t("confirmDeleteNote"))) return;
    try {
      await deleteNote.mutateAsync(note.id);
      if (editingNoteId === note.id) resetNoteFields();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("errors.noteDeleteFailed"));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!selectedDate) return;
    const date = toDateKey(selectedDate);

    if (entryType === "note") {
      if (!editingNoteId && isPastSelected) return;
      if (!noteBody.trim()) return setFormError(t("errors.noteRequired"));
      try {
        if (editingNoteId) {
          await updateNote.mutateAsync({ id: editingNoteId, body: noteBody.trim() });
        } else {
          await createNote.mutateAsync({ date, body: noteBody.trim() });
        }
        resetNoteFields();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : t("errors.noteSaveFailed"));
      }
      return;
    }

    if (!title.trim()) return setFormError(t("errors.titleRequired"));
    if (!startTime || !endTime) return setFormError(t("errors.timeRequired"));
    // Presence alone doesn't guarantee shape: <input type="time"> can fall back to free text on
    // some browsers (older/desktop Safari, some mobile browsers), letting through values like
    // "9:00 AM" or "14h30" that would otherwise reach the mutation's Date construction and throw
    // a raw, untranslated engine error. Normalizing (and zero-padding, e.g. "9:00" -> "09:00")
    // here also fixes the endAfterStart comparison below, which previously compared raw strings.
    const normalizedStart = normalizeTimeString(startTime);
    const normalizedEnd = normalizeTimeString(endTime);
    if (!normalizedStart || !normalizedEnd) return setFormError(t("errors.invalidTime"));
    if (normalizedEnd <= normalizedStart) return setFormError(t("errors.endAfterStart"));
    // isPastSelected only rules out a wholly past *day* — a same-day appointment still needs
    // its own start time checked against the clock, otherwise "today at 12:00" typed at 12:05
    // sails through unchallenged (isAppointmentPast is the same check the list view uses to
    // mark an existing appointment "Done").
    if (!editingId && isAppointmentPast({ date, startTime: normalizedStart })) {
      return setFormError(t("errors.startTimeInPast"));
    }
    try {
      if (editingId) {
        await updateAppointment.mutateAsync({
          id: editingId,
          title: title.trim(),
          date,
          startTime: normalizedStart,
          description: description.trim(),
          notifyEmail: notifyEmail.trim(),
          caseId,
          reminderLeadMinutes: reminderLeadMinutes ? Number(reminderLeadMinutes) : null,
        });
      } else {
        if (isPastSelected) return;
        await createAppointment.mutateAsync({
          title: title.trim(),
          date,
          startTime: normalizedStart,
          endTime: normalizedEnd,
          description: description.trim() || undefined,
          notifyEmail: notifyEmail.trim() || undefined,
          caseId: caseId || undefined,
          reminderLeadMinutes: reminderLeadMinutes ? Number(reminderLeadMinutes) : undefined,
        });
      }
      resetAppointmentFields();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("errors.appointmentSaveFailed"));
    }
  }

  return (
    <Card className="w-full shrink-0 backdrop-blur-sm lg:w-[340px]" size="sm">
      <CardContent className="flex flex-col gap-4">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && onSelectDay(date)}
          month={currentMonth}
          onMonthChange={onMonthChange}
          fixedWeeks
          modifiers={{ past: isPastDay, hasEvents: (date) => datesWithItems.has(toDateKey(date)) }}
          modifiersClassNames={{
            past: "rounded-(--cell-radius) bg-muted text-muted-foreground data-[selected=true]:rounded-none",
          }}
          classNames={{
            today: "rounded-(--cell-radius) bg-accent text-accent-foreground data-[selected=true]:rounded-none",
          }}
          className="mx-auto p-0 [--cell-size:--spacing(8)]"
        />

        <div className="border-t border-border pt-4">
          {editingId || editingNoteId ? (
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {editingNoteId ? t("editingNote") : t("editingAppointment")}
              </p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      resetAppointmentFields();
                      resetNoteFields();
                      setFormError(null);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t("cancelEdit")}
                  >
                    <X className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("cancelEdit")}</TooltipContent>
              </Tooltip>
            </div>
          ) : isPastSelected ? null : (
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Add to {selectedDate ? format(selectedDate, "MMM d, yyyy") : "…"}
            </p>
          )}

          {!editingId && !editingNoteId && isPastSelected ? null : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {formError && <ErrorBanner message={formError} onDismiss={() => setFormError(null)} />}

              {!editingId && !editingNoteId && (
                <div className="flex gap-1 rounded-md border border-border p-0.5">
                  <button
                    type="button"
                    onClick={() => setEntryType("appointment")}
                    className={cn(
                      "flex-1 rounded-sm py-1 text-xs font-medium transition-colors",
                      entryType === "appointment" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent dark:hover:bg-overlay-hover"
                    )}
                  >
                    {t("appointment")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryType("note")}
                    className={cn(
                      "flex-1 rounded-sm py-1 text-xs font-medium transition-colors",
                      entryType === "note" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent dark:hover:bg-overlay-hover"
                    )}
                  >
                    {t("note")}
                  </button>
                </div>
              )}

              {entryType === "note" ? (
                <div className="flex flex-col gap-1">
                  <textarea
                    placeholder={t("notePlaceholder")}
                    aria-label={t("notePlaceholder")}
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value.slice(0, NOTE_MAX_LENGTH))}
                    maxLength={NOTE_MAX_LENGTH}
                    rows={4}
                    className="w-full resize-none rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                  <p className="self-end text-xs text-muted-foreground">
                    {noteBody.length}/{NOTE_MAX_LENGTH}
                  </p>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder={t("titlePlaceholder")}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                    />
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                    />
                  </div>
                  {(() => {
                    // Guidance shown in our own styling instead of a `min` attribute — a `min` on
                    // the end-time input works, but Chrome pops up its own native constraint
                    // bubble ("Value must be X or later") mid-edit, outside the app's control and
                    // inconsistent with the rest of the UI. This is purely informational; the
                    // actual enforcement still happens via the endAfterStart check on submit.
                    const normalizedStartHint = normalizeTimeString(startTime);
                    if (!normalizedStartHint) return null;
                    return (
                      <p className="text-xs text-muted-foreground">
                        {t("endTimeHint", { time: formatTime12h(normalizedStartHint) })}
                      </p>
                    );
                  })()}
                  <input
                    type="email"
                    placeholder={t("notifyEmailPlaceholder")}
                    aria-label={t("notifyEmailPlaceholder")}
                    value={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.value)}
                    className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                  <CustomSelect
                    value={caseId}
                    onChange={setCaseId}
                    options={[
                      { value: "", label: t("noCase") },
                      ...cases.map((c) => ({ value: c.id, label: c.caseName })),
                    ]}
                  />
                  <CustomSelect
                    value={reminderLeadMinutes}
                    onChange={setReminderLeadMinutes}
                    triggerTooltip={t("reminderLabel")}
                    options={[
                      { value: "", label: t("reminderNone") },
                      { value: "1440", label: t("reminder1Day") },
                      { value: "2880", label: t("reminder2Days") },
                      { value: "4320", label: t("reminder3Days") },
                      { value: "7200", label: t("reminder5Days") },
                      { value: "10080", label: t("reminder1Week") },
                    ]}
                  />
                  <textarea
                    placeholder={t("descriptionPlaceholder")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                </>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="submit" disabled={!selectedDate || isSubmitting} className="w-full">
                    {isSubmitting
                      ? t("saving")
                      : editingId || editingNoteId
                        ? t("saveChanges")
                        : entryType === "note"
                          ? t("addNote")
                          : t("addAppointment")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {editingId
                    ? "Save changes to this appointment"
                    : editingNoteId
                      ? "Save changes to this note"
                      : entryType === "note"
                        ? "Save this note to the selected day"
                        : "Save this appointment to the selected day"}
                </TooltipContent>
              </Tooltip>
            </form>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-2 border-t">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {selectedDate ? format(selectedDate, "EEEE, MMM d") : "Select a day"}
        </p>
        {selectedAppointments.length === 0 && selectedNotes.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("nothingScheduledDay")}</p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {selectedAppointments.map((appt) => {
              const isCancelled = appt.status === "cancelled";
              const isDone = !isCancelled && isAppointmentPast(appt);
              return (
                <li
                  key={appt.id}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-md px-2.5 py-1.5 text-xs",
                    isCancelled
                      ? "bg-red-50 text-red-900 dark:bg-red-500/10 dark:text-red-300"
                      : isDone
                        ? "bg-green-50 text-green-900 dark:bg-green-500/10 dark:text-green-300"
                        : "bg-blue-50 text-blue-900 dark:bg-blue-500/15 dark:text-blue-300"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-medium", isCancelled && "line-through")}>
                        {appt.title}
                        {isCancelled && <span className="ml-1.5 font-normal">({t("statusCancelled")})</span>}
                        {isDone && <span className="ml-1.5 font-normal">({t("statusDone")})</span>}
                      </p>
                      <p
                        className={cn(
                          isCancelled ? "text-red-700 dark:text-red-300" : isDone ? "text-green-700 dark:text-green-300" : "text-blue-700 dark:text-blue-300"
                        )}
                      >
                        {appt.endTime
                          ? `${formatTime12h(appt.startTime)} – ${formatTime12h(appt.endTime)}`
                          : formatTime12h(appt.startTime)}
                      </p>
                      {appt.description && <p className="mt-0.5 line-clamp-4 break-words">{appt.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 pl-5">
                    {isCancelled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setAppointmentStatus(appt, "pending")}
                            className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"
                            aria-label={t("restore")}
                          >
                            <Undo2 className="size-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("restore")}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => startEdit(appt)}
                              className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"
                              aria-label={t("edit")}
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{t("edit")}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => setAppointmentStatus(appt, "cancelled")}
                              className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"
                              aria-label={t("cancelAppointment")}
                            >
                              <Ban className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{t("cancelAppointment")}</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
            {selectedNotes.map((note) => (
              <li
                key={note.id}
                className="flex flex-col gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-500/15 dark:text-amber-300"
              >
                <div className="flex items-start gap-2">
                  <StickyNote className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <p className="min-w-0 flex-1 line-clamp-4 break-words">{note.body}</p>
                </div>
                <div className="flex items-center gap-0.5 pl-5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => startEditNote(note)}
                        className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"
                        aria-label={t("edit")}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("edit")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note)}
                        className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"
                        aria-label={t("deleteNote")}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("deleteNote")}</TooltipContent>
                  </Tooltip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardFooter>
    </Card>
  );
}

/* ==========================================
   MAIN CALENDAR PAGE
   ========================================== */
export default function CalendarPage() {
  const { t } = useTranslation("calendar");
  const searchParams = useSearchParams();
  const initialCaseId = searchParams.get("caseId");
  const [currentMonth, setCurrentMonth] = React.useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());

  const from = toDateKey(startOfMonth(currentMonth));
  const to = toDateKey(endOfMonth(currentMonth));

  const appointmentsQuery = useAppointmentsQuery(from, to);
  const appointments = appointmentsQuery.data ?? [];
  const notesQuery = useNotesQuery(from, to);
  const notes = notesQuery.data ?? [];

  const handleSelectDay = React.useCallback(
    (date: Date) => {
      setSelectedDate(date);
      if (!isSameMonth(date, currentMonth)) {
        setCurrentMonth(startOfMonth(date));
      }
    },
    [currentMonth]
  );

  const itemsByDate = React.useMemo(() => {
    const grouped = new Map<string, DayItem[]>();

    for (const appt of appointments) {
      const list = grouped.get(appt.date) ?? [];
      list.push({
        id: appt.id,
        title: appt.title,
        time: formatTime12h(appt.startTime),
        sortKey: appt.startTime,
        kind: "appointment",
        cancelled: appt.status === "cancelled",
      });
      grouped.set(appt.date, list);
    }

    for (const note of notes) {
      const list = grouped.get(note.date) ?? [];
      list.push({
        id: note.id,
        title: note.body,
        time: null,
        // Notes have no time, so they always sort after the day's appointments.
        sortKey: "24:00",
        kind: "note",
      });
      grouped.set(note.date, list);
    }

    const result = new Map<string, DayItems>();
    for (const [date, list] of grouped) {
      list.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      result.set(date, {
        visible: list.slice(0, MAX_VISIBLE_PER_DAY),
        overflowCount: Math.max(0, list.length - MAX_VISIBLE_PER_DAY),
      });
    }
    return result;
  }, [appointments, notes]);

  const datesWithItems = React.useMemo(() => new Set(itemsByDate.keys()), [itemsByDate]);

  const selectedDateKey = selectedDate ? toDateKey(selectedDate) : null;
  const selectedAppointments = React.useMemo(
    () =>
      appointments
        .filter((a) => a.date === selectedDateKey)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [appointments, selectedDateKey]
  );
  const selectedNotes = React.useMemo(
    () => notes.filter((n) => n.date === selectedDateKey),
    [notes, selectedDateKey]
  );

  return (
    <PageShell activeTab="calendar">
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 md:px-16 pb-6 pt-24">
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="font-['Libre_Caslon_Text'] text-4xl text-foreground">Calendar</h1>
          <p className="max-w-xl text-base text-muted-foreground">Track hearings and deadlines in one place.</p>
        </div>

        <div className="flex flex-col items-start gap-6 lg:flex-row">
          <PlannerPanel
            selectedDate={selectedDate}
            currentMonth={currentMonth}
            onSelectDay={handleSelectDay}
            onMonthChange={setCurrentMonth}
            selectedAppointments={selectedAppointments}
            selectedNotes={selectedNotes}
            initialCaseId={initialCaseId}
            datesWithItems={datesWithItems}
          />

          {/* Desktop/tablet only — PlannerPanel's own calendar grid + selected-day list above
              already covers mobile's date-picking and "what's on this day" needs, so this
              month-grid + agenda pairing would otherwise just repeat the same day's notes. */}
          <Card className="hidden w-full flex-1 backdrop-blur-sm md:block">
            <CardHeader className="flex flex-row items-center gap-3 border-b border-border">
              <div className="flex flex-1 items-center justify-center gap-2">
                <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
              </div>

              {(appointmentsQuery.isError || notesQuery.isError) && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 py-1 pl-3 pr-1 text-xs text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300"
                >
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>{t("errors.loadFailed")}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          appointmentsQuery.refetch();
                          notesQuery.refetch();
                        }}
                        className="flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-red-700 transition-colors hover:bg-red-100 hover:text-red-900 dark:text-red-200 dark:hover:bg-red-500/20 dark:hover:text-white"
                      >
                        <RotateCw className="size-3" aria-hidden="true" />
                        {t("retry")}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Retry loading this month&rsquo;s schedule</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 md:px-6 md:pb-6">
              <CalendarItemsContext.Provider value={{ itemsByDate, selectedDate, onSelectDay: handleSelectDay }}>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && handleSelectDay(date)}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  showOutsideDays
                  fixedWeeks
                  components={{ DayButton: CalendarDayCell }}
                  modifiers={{ past: isPastDay }}
                  classNames={{
                    nav: "hidden",
                    month_caption: "hidden",
                    day: "flex-1 basis-0 min-w-0 max-w-full self-start overflow-hidden p-0.5 align-top",
                    week: "mt-2 flex w-full items-start",
                    // table-fixed pins each column to an equal share of the table's own width
                    // (set once, by the table itself — not by any cell's content). Without it,
                    // the browser's table auto-layout still sizes columns from each cell's
                    // *unconstrained* content width (a <td> stays a table-layout participant for
                    // width purposes even once its display is overridden to flex), so one long,
                    // unwrapped appointment/note title was enough to blow a single column wide
                    // and shove the rest of the week off-screen — the flex-1/min-w-0 overrides on
                    // "day" alone couldn't prevent that.
                    month_grid: "w-full table-fixed border-collapse",
                    today: "",
                  }}
                  className="w-full p-0"
                />
              </CalendarItemsContext.Provider>
            </CardContent>
          </Card>
        </div>
      </main>
    </PageShell>
  );
}
