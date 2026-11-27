import { describe, expect, it } from "vitest"
import { resolveSignedInAuthPageAction } from "../signed-in-auth-page"

const action = (query: string) => resolveSignedInAuthPageAction(new URLSearchParams(query))

describe("resolveSignedInAuthPageAction", () => {
  it("redirects a signed-in user away from a plain /login", () => {
    expect(action("")).toBe("redirect")
    expect(action("next=/homepage/cases")).toBe("redirect")
  })

  it("checks the signed-in address against an org-invite ?email= link", () => {
    expect(action("email=a%40b.com&tab=signup")).toBe("check-invited-email")
  })

  it("shows the form for a copy-link case invite (no email), so the token can be redeemed", () => {
    expect(action("caseInviteToken=tok-1")).toBe("show-form")
  })

  it("shows the form for an email case invite even when the address matches the session", () => {
    expect(action("caseInviteToken=tok-1&email=a%40b.com&tab=signup")).toBe("show-form")
  })

  it("ignores an empty caseInviteToken", () => {
    expect(action("caseInviteToken=")).toBe("redirect")
  })
})
