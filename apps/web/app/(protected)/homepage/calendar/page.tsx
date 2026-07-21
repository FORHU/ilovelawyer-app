"use client";

import * as React from "react";
import GlobalHeader from "@/components/global-header";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Calendar } from "@workspace/ui/components/calendar";
import { cn } from "@workspace/ui/lib/utils";
import type { DayButton } from "react-day-picker";
import { addMonths, format, isSameDay, isSameMonth, parse, startOfMonth, subMonths, endOfMonth } from "date-fns";
import { AlertCircle, ChevronLeft, ChevronRight, Clock, RotateCw, StickyNote, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useAppointmentsQuery,
  useCreateAppointmentMutation,
  useCreateNoteMutation,
  useNotesQuery,
} from "@/lib/calendar/mutations";

const MAX_VISIBLE_PER_DAY = 2;

function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function formatTime12h(time: string): string {
  return format(parse(time, "HH:mm", new Date()), "h:mm a");
}

/* ==========================================
   MONTH GRID DAY CELL (appointments + notes)
   ========================================== */
type DayItem = { id: string; kind: "appointment" | "note"; label: string; sortKey: string };
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

  return (
    <button
      type="button"
      onClick={() => onSelectDay(day.date)}
      disabled={props.disabled}
      className={cn(
        "flex h-full min-h-[92px] w-full flex-col items-start gap-1 rounded-lg border p-1.5 text-left align-top transition-colors hover:bg-white/5 disabled:pointer-events-none disabled:opacity-40",
        modifiers.outside ? "border-white/5 text-muted-foreground" : "border-white/10",
        isSelected && "border-primary bg-primary/10",
        className
      )}
    >
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full text-xs font-medium",
          modifiers.today && "bg-primary font-bold text-primary-foreground"
        )}
      >
        {day.date.getDate()}
      </span>
      <div className="flex w-full flex-col gap-0.5 overflow-hidden">
        {dayItems?.visible.map((item) => (
          <span
            key={item.id}
            className={cn(
              "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] leading-tight",
              item.kind === "appointment" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
            )}
          >
            {item.kind === "appointment" ? (
              <Clock className="size-2.5 shrink-0" aria-hidden="true" />
            ) : (
              <StickyNote className="size-2.5 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{item.label}</span>
          </span>
        ))}
        {dayItems && dayItems.overflowCount > 0 && (
          <span className="text-[10px] text-muted-foreground">{t("overflowMore", { count: dayItems.overflowCount })}</span>
        )}
      </div>
    </button>
  );
}

/* ==========================================
   AGENDA VIEW (mobile replacement for the 7-column grid below md)
   ========================================== */
type AgendaAppointment = { id: string; date: string; title: string; startTime: string; endTime: string; description: string | null };
type AgendaNote = { id: string; date: string; body: string };
type AgendaDay = { date: Date; appointments: AgendaAppointment[]; notes: AgendaNote[] };

function AgendaView({
  agendaDays,
  selectedDate,
  onSelectDay,
}: {
  agendaDays: AgendaDay[];
  selectedDate: Date | undefined;
  onSelectDay: (date: Date) => void;
}) {
  const { t } = useTranslation("calendar");
  if (agendaDays.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-white/40">{t("nothingScheduledMonth")}</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-white/10">
      {agendaDays.map((day) => {
        const isSelected = selectedDate ? isSameDay(day.date, selectedDate) : false;
        return (
          <button
            key={toDateKey(day.date)}
            type="button"
            onClick={() => onSelectDay(day.date)}
            className={cn(
              "flex flex-col gap-2 px-4 py-4 text-left transition-colors hover:bg-white/5",
              isSelected && "bg-primary/10"
            )}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">
              {format(day.date, "EEEE, MMM d")}
            </span>
            <div className="flex flex-col gap-1.5">
              {day.appointments.map((appt) => (
                <span
                  key={appt.id}
                  className="flex items-center gap-2 rounded-md bg-blue-500/10 px-2.5 py-1.5 text-xs text-blue-200"
                >
                  <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                  {formatTime12h(appt.startTime)} · {appt.title}
                </span>
              ))}
              {day.notes.map((note) => (
                <span
                  key={note.id}
                  className="flex items-center gap-2 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200"
                >
                  <StickyNote className="size-3.5 shrink-0" aria-hidden="true" />
                  {note.body}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ==========================================
   DISMISSIBLE INLINE ERROR BANNER
   ========================================== */
function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const { t } = useTranslation("calendar");
  return (
    <div className="flex items-center gap-3 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-red-800" role="alert">
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
      <p className="text-xs">{message}</p>
      <button type="button" onClick={onDismiss} className="ml-auto cursor-pointer text-red-700 hover:text-red-900" aria-label={t("dismissError")}>
        <X className="size-3.5" />
      </button>
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
}: {
  selectedDate: Date | undefined;
  currentMonth: Date;
  onSelectDay: (date: Date) => void;
  onMonthChange: (month: Date) => void;
  selectedAppointments: { id: string; title: string; startTime: string; endTime: string; description: string | null }[];
  selectedNotes: { id: string; body: string }[];
}) {
  const [itemType, setItemType] = React.useState<"appointment" | "note">("appointment");
  const [title, setTitle] = React.useState("");
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [noteBody, setNoteBody] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const { t } = useTranslation("calendar");

  const createAppointment = useCreateAppointmentMutation();
  const createNote = useCreateNoteMutation();
  const isSubmitting = createAppointment.isPending || createNote.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!selectedDate) return;
    const date = toDateKey(selectedDate);

    if (itemType === "appointment") {
      if (!title.trim()) return setFormError(t("errors.titleRequired"));
      if (!startTime || !endTime) return setFormError(t("errors.timeRequired"));
      if (endTime <= startTime) return setFormError(t("errors.endAfterStart"));
      try {
        await createAppointment.mutateAsync({
          title: title.trim(),
          date,
          startTime,
          endTime,
          description: description.trim() || undefined,
        });
        setTitle("");
        setStartTime("");
        setEndTime("");
        setDescription("");
      } catch (err) {
        setFormError(err instanceof Error ? err.message : t("errors.appointmentSaveFailed"));
      }
    } else {
      if (!noteBody.trim()) return setFormError(t("errors.noteRequired"));
      try {
        await createNote.mutateAsync({ date, body: noteBody.trim() });
        setNoteBody("");
      } catch (err) {
        setFormError(err instanceof Error ? err.message : t("errors.noteSaveFailed"));
      }
    }
  }

  return (
    <Card className="w-full shrink-0 bg-[#0b132b]/90 backdrop-blur-sm lg:w-[340px]" size="sm">
      <CardContent className="flex flex-col gap-4">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && onSelectDay(date)}
          month={currentMonth}
          onMonthChange={onMonthChange}
          fixedWeeks
          className="mx-auto p-0 [--cell-size:--spacing(8)]"
        />

        <div className="border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            {t("addTo", { date: selectedDate ? format(selectedDate, "MMM d, yyyy") : "…" })}
          </p>

          <div className="mb-3 flex gap-2">
            <Button
              type="button"
              variant={itemType === "appointment" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setItemType("appointment")}
            >
              {t("appointment")}
            </Button>
            <Button
              type="button"
              variant={itemType === "note" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setItemType("note")}
            >
              {t("note")}
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {formError && <ErrorBanner message={formError} onDismiss={() => setFormError(null)} />}

            {itemType === "appointment" ? (
              <>
                <input
                  type="text"
                  placeholder={t("titlePlaceholder")}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-black"
                />
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-black"
                  />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-black"
                  />
                </div>
                <textarea
                  placeholder={t("descriptionPlaceholder")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-black"
                />
              </>
            ) : (
              <textarea
                placeholder={t("notePlaceholder")}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-black"
              />
            )}

            <Button type="submit" disabled={!selectedDate || isSubmitting} className="w-full">
              {isSubmitting ? t("saving") : itemType === "appointment" ? t("addAppointment") : t("addNote")}
            </Button>
          </form>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-2 border-t">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
          {selectedDate ? format(selectedDate, "EEEE, MMM d") : t("selectDay")}
        </p>
        {selectedAppointments.length === 0 && selectedNotes.length === 0 ? (
          <p className="text-xs text-slate-400">{t("nothingScheduledDay")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {selectedAppointments.map((appt) => (
              <li key={appt.id} className="flex items-start gap-2 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-blue-900">
                <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium">{appt.title}</p>
                  <p className="text-blue-700">
                    {formatTime12h(appt.startTime)} – {formatTime12h(appt.endTime)}
                  </p>
                  {appt.description && <p className="mt-0.5 text-blue-700">{appt.description}</p>}
                </div>
              </li>
            ))}
            {selectedNotes.map((note) => (
              <li key={note.id} className="flex items-start gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                <StickyNote className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <p>{note.body}</p>
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
  const [currentMonth, setCurrentMonth] = React.useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());

  const from = toDateKey(startOfMonth(currentMonth));
  const to = toDateKey(endOfMonth(currentMonth));

  const appointmentsQuery = useAppointmentsQuery(from, to);
  const notesQuery = useNotesQuery(from, to);
  const appointments = appointmentsQuery.data ?? [];
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
        kind: "appointment",
        label: `${formatTime12h(appt.startTime)} ${appt.title}`,
        sortKey: `0${appt.startTime}`,
      });
      grouped.set(appt.date, list);
    }
    for (const note of notes) {
      const list = grouped.get(note.date) ?? [];
      list.push({ id: note.id, kind: "note", label: note.body, sortKey: `1${note.id}` });
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

  const agendaDays = React.useMemo(() => {
    const grouped = new Map<string, AgendaDay>();
    for (const appt of appointments) {
      const entry = grouped.get(appt.date) ?? { date: parse(appt.date, "yyyy-MM-dd", new Date()), appointments: [], notes: [] };
      entry.appointments.push(appt);
      grouped.set(appt.date, entry);
    }
    for (const note of notes) {
      const entry = grouped.get(note.date) ?? { date: parse(note.date, "yyyy-MM-dd", new Date()), appointments: [], notes: [] };
      entry.notes.push(note);
      grouped.set(note.date, entry);
    }
    return Array.from(grouped.values())
      .map((day) => ({ ...day, appointments: [...day.appointments].sort((a, b) => a.startTime.localeCompare(b.startTime)) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [appointments, notes]);

  const selectedDateKey = selectedDate ? toDateKey(selectedDate) : null;
  const selectedAppointments = React.useMemo(
    () =>
      appointments
        .filter((a) => a.date === selectedDateKey)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [appointments, selectedDateKey]
  );
  const selectedNotes = React.useMemo(() => notes.filter((n) => n.date === selectedDateKey), [notes, selectedDateKey]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <GlobalHeader activeTab="calendar" />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 md:px-16 pb-6 pt-16">
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="font-['Libre_Caslon_Text'] text-4xl text-[#131a33]">{t("title")}</h1>
          <p className="max-w-xl text-base text-gray-500">{t("subtitle")}</p>
        </div>

        <div className="flex flex-col items-start gap-6 lg:flex-row">
          <PlannerPanel
            selectedDate={selectedDate}
            currentMonth={currentMonth}
            onSelectDay={handleSelectDay}
            onMonthChange={setCurrentMonth}
            selectedAppointments={selectedAppointments}
            selectedNotes={selectedNotes}
          />

          <Card className="w-full flex-1 bg-[#0b132b]/90 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 text-white/70 hover:bg-white/10 hover:text-white"
                    onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
                    aria-label={t("previousMonth")}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 text-white/70 hover:bg-white/10 hover:text-white"
                    onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                    aria-label={t("nextMonth")}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
              </div>

              {(appointmentsQuery.isError || notesQuery.isError) && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 py-1 pl-3 pr-1 text-xs text-red-300"
                >
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>{t("errors.loadFailed")}</span>
                  <button
                    type="button"
                    onClick={() => {
                      appointmentsQuery.refetch();
                      notesQuery.refetch();
                    }}
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-red-200 transition-colors hover:bg-red-500/20 hover:text-white"
                  >
                    <RotateCw className="size-3" aria-hidden="true" />
                    {t("retry")}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 md:px-6 md:pb-6">
              {/* Below md the 7-column grid has no reasonable shrink path to phone width,
                  so it's replaced entirely by a scrollable Agenda View (see ADR 0004). */}
              <div className="hidden md:block">
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
                    classNames={{
                      nav: "hidden",
                      month_caption: "hidden",
                      day: "flex-1 basis-0 p-0.5 align-top",
                      month_grid: "w-full border-collapse",
                    }}
                    className="w-full p-0"
                  />
                </CalendarItemsContext.Provider>
              </div>
              <div className="md:hidden">
                <AgendaView agendaDays={agendaDays} selectedDate={selectedDate} onSelectDay={handleSelectDay} />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
