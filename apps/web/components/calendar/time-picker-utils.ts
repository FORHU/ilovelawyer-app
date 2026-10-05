// Pure helpers behind <TimePicker>. Times are passed around as minutes since midnight
// internally and as "HH:mm" (24h) at the component boundary, matching what the
// appointments API stores.

export const STEP_MINUTES = 15;
const MINUTES_PER_DAY = 24 * 60;

export function toMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function toValue(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

/** Every quarter hour of the day, plus `extra` when it falls between steps — an
 * appointment saved at e.g. 10:07 still needs a selectable row to show as selected. */
export function buildSlots(extra: number | null): number[] {
  const slots = Array.from({ length: MINUTES_PER_DAY / STEP_MINUTES }, (_, i) => i * STEP_MINUTES);
  if (extra !== null && extra % STEP_MINUTES !== 0) {
    slots.push(extra);
    slots.sort((a, b) => a - b);
  }
  return slots;
}

export function nextQuarterHour(now: Date): number {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return (Math.ceil(minutes / STEP_MINUTES) * STEP_MINUTES) % MINUTES_PER_DAY;
}

/** Splits a duration into hours/minutes so the caller can localise the label. */
export function splitDuration(minutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

/** Parses typed input: "9", "930", "9:30", "14:30", "2pm", "2:30 PM". Without AM/PM the
 * hour is read as 24h. Returns minutes since midnight, or null if it isn't a real time. */
export function parseTypedTime(input: string): number | null {
  const compact = input.trim().toLowerCase().replace(/\s+/g, "");
  const match = /^(\d{1,2})(?::?(\d{2}))?(am|pm|a|p)?$/.exec(compact);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const period = match[3];
  if (minute > 59) return null;
  if (period) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (period.startsWith("p") ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }
  return hour * 60 + minute;
}

export const TYPED_TIME_MAX_LENGTH = "12:30 PM".length;

/** Formats free typing into "h:mm AM" as the user goes: digits only (max 4), a colon
 * inserted before the last two digits, and a typed "a"/"p" becomes " AM"/" PM". */
export function maskTypedTime(raw: string): string {
  const upper = raw.toUpperCase();
  const letters = upper.match(/[AP]/g);
  const period = letters ? `${letters[letters.length - 1]}M` : "";
  const body = upper.replace(/[^0-9:]/g, "");
  const [hourPart = "", minutePart = ""] = body.split(":").map((s) => s.replace(/\D/g, ""));

  let time: string;
  if (body.includes(":") && minutePart.length <= 2) {
    // The user typed the colon (or minutes are still being filled in) — keep their split.
    time = `${hourPart.slice(0, 2)}:${minutePart}`;
  } else {
    // No colon yet, or minutes overflowed (e.g. "1:230") — re-split as hmm / hhmm.
    const digits = (hourPart + minutePart).slice(0, 4);
    time = digits.length <= 2 ? digits : `${digits.slice(0, -2)}:${digits.slice(-2)}`;
  }
  return time && period ? `${time} ${period}` : time;
}

export type TypedTimeProblem = "minutes" | "hours12" | "hours24";

/** Flags a fully typed "h:mm" / "h:mm AM" that can't be a real time, so the error can
 * show while typing instead of waiting for Set. Incomplete input returns null. */
export function typedTimeProblem(value: string): TypedTimeProblem | null {
  const match = /^(\d{1,2}):(\d{2})(?: ([AP]M))?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  if (Number(match[2]) > 59) return "minutes";
  if (match[3] && (hour < 1 || hour > 12)) return "hours12";
  if (hour > 23) return "hours24";
  return null;
}
