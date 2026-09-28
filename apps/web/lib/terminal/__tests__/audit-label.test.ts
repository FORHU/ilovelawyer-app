import { describe, it, expect } from "vitest"
import { auditActionLabel, auditEventText, withAuditEvent } from "../audit-label"

describe("auditActionLabel", () => {
  it("turns subject.verb slugs into readable phrases", () => {
    expect(auditActionLabel("risk.create")).toBe("Risk added")
    expect(auditActionLabel("mindMap.expand")).toBe("Mind map expanded")
    expect(auditActionLabel("document.unarchive")).toBe("Document restored")
  })

  it("maps a snake_case verb", () => {
    expect(auditActionLabel("case.grant_access")).toBe("Case access granted")
  })

  it("keeps the middle segment of three-part actions", () => {
    expect(auditActionLabel("evidence.custody.add")).toBe("Evidence custody added")
  })

  it("falls back to the raw verb for an unmapped action", () => {
    expect(auditActionLabel("citationMap.adverseSweep")).toBe("Citation map adverse sweep")
  })

  it("handles an action with no subject", () => {
    expect(auditActionLabel("refresh")).toBe("Refresh")
  })
})

describe("auditEventText", () => {
  it("appends the subject when present", () => {
    expect(auditEventText({ action: "risk.create", subject: "No written protest" })).toBe('Risk added: “No written protest”')
    expect(auditEventText({ action: "risk.create", subject: null })).toBe("Risk added")
  })
})

describe("withAuditEvent", () => {
  it("prepends a new event and ignores a duplicate id", () => {
    const a = { id: "a" }
    const b = { id: "b" }
    expect(withAuditEvent([a], b)).toEqual([b, a])
    const list = [a]
    expect(withAuditEvent(list, { id: "a" })).toBe(list)
  })

  it("caps the log length", () => {
    expect(withAuditEvent([{ id: "1" }, { id: "2" }], { id: "3" }, 2)).toEqual([{ id: "3" }, { id: "1" }])
  })
})
