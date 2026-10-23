import { describe, expect, it } from "vitest"
import {
  keepAmount,
  keepDigits,
  keepMcleNumber,
  keepPhone,
  keepRomanNumeral,
  keepUkPostcode,
  keepWords,
  phoneProblem,
  postcodeProblem,
} from "@/lib/forms/field-rules"

describe("what a field can be typed into", () => {
  it("keeps a phone number to digits and spaces, with a + in front", () => {
    expect(keepPhone("+44 20 7946 abc0958")).toBe("+44 20 7946 0958")
    expect(keepPhone("0917-123-4567")).toBe("09171234567")
    expect(keepPhone("44+20")).toBe("4420")
  })

  it("keeps numbers to digits", () => {
    expect(keepDigits("SRA 612-345")).toBe("612345")
  })

  it("keeps places, chapters and languages to letters", () => {
    expect(keepWords("Manila 3")).toBe("Manila ")
    expect(keepWords("Stoke-on-Trent")).toBe("Stoke-on-Trent")
    expect(keepWords("Español")).toBe("Español")
  })

  it("keeps a UK postcode in capitals, an MCLE number and period in their shapes, and an amount", () => {
    expect(keepUkPostcode("sw1a-1aa")).toBe("SW1A1AA")
    expect(keepMcleNumber("vii/0012345")).toBe("VII0012345")
    expect(keepRomanNumeral("vii 2022")).toBe("VII")
    expect(keepAmount("£149.5.0x")).toBe("149.50")
  })
})

describe("what a finished value needs", () => {
  it("wants 7 to 15 digits in a phone number", () => {
    expect(phoneProblem("")).toBeNull()
    expect(phoneProblem("+44 20 7946 0958")).toBeNull()
    expect(phoneProblem("123")).not.toBeNull()
  })

  it("wants a UK postcode on UK and a 4-digit ZIP code on PH", () => {
    expect(postcodeProblem("sw1a 1aa", "UK")).toBeNull()
    expect(postcodeProblem("1000", "UK")).not.toBeNull()
    expect(postcodeProblem("1000", "PH")).toBeNull()
    expect(postcodeProblem("100", "PH")).not.toBeNull()
  })
})
