import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { toastPassError } from "../plan-errors"

vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn() } }))

const LABELS = { gone: "Gone", fallback: "Try again", choosePlan: "Plans", onChoosePlan: () => {} }
const apiError = (status: number, message: string, code?: string) => Object.assign(new Error(message), { status, code })

describe("toastPassError", () => {
  beforeEach(() => vi.clearAllMocks())

  it("says plainly that a request already gone (404) has left the inbox", () => {
    toastPassError(apiError(404, "Request not found"), LABELS)
    expect(toast.info).toHaveBeenCalledWith("Gone")
    expect(toast.error).not.toHaveBeenCalled()
  })
  it("shows the API's own words for any other answer", () => {
    toastPassError(apiError(409, "You hold this request. Release it instead.", "INVALID_REQUEST_STATUS"), LABELS)
    expect(toast.error).toHaveBeenCalledWith("You hold this request. Release it instead.")
  })
  it("shows the fallback with no answer at all", () => {
    toastPassError(new TypeError("Failed to fetch"), LABELS)
    expect(toast.error).toHaveBeenCalledWith("Try again")
  })
})
