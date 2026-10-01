import { describe, it, expect } from "vitest"
import {
  buildSlots,
  formatMinutes,
  maskTypedTime,
  nextQuarterHour,
  parseTypedTime,
  toMinutes,
  toValue,
  typedTimeProblem,
} from "../time-picker-utils"

/** Feeds characters one at a time through the mask, as the input's onChange would. */
function type(keys: string): string {
  let value = ""
  for (const key of keys) value = maskTypedTime(value + key).slice(0, 8)
  return value
}

describe("toMinutes / toValue", () => {
  it("round-trips HH:mm", () => {
    expect(toMinutes("09:30")).toBe(570)
    expect(toValue(570)).toBe("09:30")
    expect(toValue(0)).toBe("00:00")
  })

  it("rejects malformed or out-of-range values", () => {
    expect(toMinutes("")).toBeNull()
    expect(toMinutes("9:30")).toBeNull()
    expect(toMinutes("24:00")).toBeNull()
    expect(toMinutes("10:60")).toBeNull()
  })
})

describe("formatMinutes", () => {
  it("formats as 12-hour time", () => {
    expect(formatMinutes(0)).toBe("12:00 AM")
    expect(formatMinutes(12 * 60)).toBe("12:00 PM")
    expect(formatMinutes(14 * 60 + 5)).toBe("2:05 PM")
  })
})

describe("buildSlots", () => {
  it("lists every quarter hour of the day", () => {
    const slots = buildSlots(null)
    expect(slots).toHaveLength(96)
    expect(slots[0]).toBe(0)
    expect(slots[95]).toBe(23 * 60 + 45)
  })

  it("adds an off-step value in order so a saved 10:07 stays selectable", () => {
    const slots = buildSlots(10 * 60 + 7)
    expect(slots).toHaveLength(97)
    expect(slots.slice(40, 43)).toEqual([600, 607, 615])
  })

  it("doesn't duplicate an on-step value", () => {
    expect(buildSlots(600)).toHaveLength(96)
  })
})

describe("nextQuarterHour", () => {
  it("rounds up to the next quarter and wraps at midnight", () => {
    expect(nextQuarterHour(new Date(2026, 9, 7, 9, 1))).toBe(9 * 60 + 15)
    expect(nextQuarterHour(new Date(2026, 9, 7, 9, 15))).toBe(9 * 60 + 15)
    expect(nextQuarterHour(new Date(2026, 9, 7, 23, 50))).toBe(0)
  })
})

describe("parseTypedTime", () => {
  it.each([
    ["9", 9 * 60],
    ["930", 9 * 60 + 30],
    ["9:30", 9 * 60 + 30],
    ["14:30", 14 * 60 + 30],
    ["1430", 14 * 60 + 30],
    ["2pm", 14 * 60],
    ["2:30 PM", 14 * 60 + 30],
    ["12am", 0],
    ["12:15 pm", 12 * 60 + 15],
    ["0:45", 45],
  ])("parses %s", (input, expected) => {
    expect(parseTypedTime(input)).toBe(expected)
  })

  it.each(["", "abc", "25:00", "9:75", "13pm", "0am", "12:3"])("rejects %s", (input) => {
    expect(parseTypedTime(input)).toBeNull()
  })
})

describe("maskTypedTime", () => {
  it("inserts the colon before the last two digits", () => {
    expect(type("930")).toBe("9:30")
    expect(type("1030")).toBe("10:30")
    expect(type("1230")).toBe("12:30")
  })

  it("keeps a colon the user typed", () => {
    expect(type("9:")).toBe("9:")
    expect(type("9:15")).toBe("9:15")
  })

  it("turns a or p into AM/PM", () => {
    expect(type("1030p")).toBe("10:30 PM")
    expect(type("2a")).toBe("2 AM")
  })

  it("drops other characters and caps the length", () => {
    expect(type("abc12x30")).toBe("12:30")
    expect(type("12345678")).toBe("12:34")
    expect(type("1230pm99")).toBe("12:30 PM")
  })
})

describe("typedTimeProblem", () => {
  it("flags complete but impossible times", () => {
    expect(typedTimeProblem("9:75")).toBe("minutes")
    expect(typedTimeProblem("14:00 PM")).toBe("hours12")
    expect(typedTimeProblem("25:00")).toBe("hours24")
  })

  it("ignores valid or still-incomplete input", () => {
    expect(typedTimeProblem("10:30 AM")).toBeNull()
    expect(typedTimeProblem("23:45")).toBeNull()
    expect(typedTimeProblem("10:3")).toBeNull()
    expect(typedTimeProblem("1")).toBeNull()
  })
})
