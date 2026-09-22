import { describe, expect, it, vi } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import { caseKeys, chatKeys } from "@/lib/query-keys"
import { terminalKeys } from "@/lib/terminal/mutations"
import type { UserDocument } from "@/lib/cases/mutations"
import {
  applyDocumentEvent,
  registerDocumentSocketHandlers,
  type DocumentSocketPayload,
} from "@/lib/cases/document-socket"

function doc(id: string, ragStatus: UserDocument["ragStatus"] = "PENDING"): UserDocument {
  return {
    id,
    userId: "u1",
    caseId: "case1",
    name: `${id}.pdf`,
    fileUrl: null,
    aiSummary: null,
    ragStatus,
    isExhibit: false,
    status: "ACTIVE",
    createdAt: "2026-09-21T00:00:00.000Z",
  }
}

const base: DocumentSocketPayload = {
  documentId: "d1",
  caseId: "case1",
  consultationId: "consult1",
  ragStatus: "READY",
}

describe("applyDocumentEvent", () => {
  it("patches the case list and the consultation list, leaving other documents alone", () => {
    const qc = new QueryClient()
    qc.setQueryData(caseKeys.timeline("case1"), [doc("d1"), doc("d2")])
    qc.setQueryData(chatKeys.documents("consult1"), [doc("d1")])

    applyDocumentEvent(qc, "document:ready", { ...base, category: "Contract" })

    const caseDocs = qc.getQueryData<UserDocument[]>(caseKeys.timeline("case1"))!
    expect(caseDocs[0]).toMatchObject({ id: "d1", ragStatus: "READY", category: "Contract" })
    expect(caseDocs[1]).toMatchObject({ id: "d2", ragStatus: "PENDING" })
    expect(qc.getQueryData<UserDocument[]>(chatKeys.documents("consult1"))![0]!.ragStatus).toBe("READY")
  })

  it("also patches the archived list for the case (same key prefix)", () => {
    const qc = new QueryClient()
    qc.setQueryData(caseKeys.archivedTimeline("case1"), [doc("d1")])

    applyDocumentEvent(qc, "document:failed", { ...base, ragStatus: "FAILED" })

    expect(qc.getQueryData<UserDocument[]>(caseKeys.archivedTimeline("case1"))![0]!.ragStatus).toBe("FAILED")
  })

  it("keeps the existing category when the event carries none", () => {
    const qc = new QueryClient()
    qc.setQueryData(caseKeys.timeline("case1"), [{ ...doc("d1"), category: "Evidence" }])

    applyDocumentEvent(qc, "document:ready", { ...base, category: null })

    expect(qc.getQueryData<UserDocument[]>(caseKeys.timeline("case1"))![0]!.category).toBe("Evidence")
  })

  it("does not touch a list that has no such document or was never loaded", () => {
    const qc = new QueryClient()
    const list = [doc("other")]
    qc.setQueryData(caseKeys.timeline("case1"), list)

    applyDocumentEvent(qc, "document:ready", base)

    expect(qc.getQueryData(caseKeys.timeline("case1"))).toBe(list)
    expect(qc.getQueryData(chatKeys.documents("consult1"))).toBeUndefined()
  })

  it("is idempotent — a replayed event leaves the same state", () => {
    const qc = new QueryClient()
    qc.setQueryData(caseKeys.timeline("case1"), [doc("d1")])

    applyDocumentEvent(qc, "document:ready", base)
    const once = qc.getQueryData(caseKeys.timeline("case1"))
    applyDocumentEvent(qc, "document:ready", base)

    expect(qc.getQueryData(caseKeys.timeline("case1"))).toEqual(once)
  })

  it("invalidates the Terminal snapshot only on a terminal state", () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, "invalidateQueries")

    applyDocumentEvent(qc, "document:started", { ...base, ragStatus: "PENDING" })
    applyDocumentEvent(qc, "document:retrying", { ...base, ragStatus: "PENDING" })
    expect(spy).not.toHaveBeenCalled()

    applyDocumentEvent(qc, "document:ready", base)
    applyDocumentEvent(qc, "document:failed", { ...base, ragStatus: "FAILED" })
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenCalledWith({ queryKey: terminalKeys.snapshot("case1") })
  })
})

describe("registerDocumentSocketHandlers", () => {
  it("listens for all four document events and removes exactly those listeners on cleanup", () => {
    const listeners = new Map<string, (payload: DocumentSocketPayload) => void>()
    const socket = {
      on: vi.fn((event: string, fn: (payload: DocumentSocketPayload) => void) => listeners.set(event, fn)),
      off: vi.fn((event: string) => listeners.delete(event)),
    }
    const qc = new QueryClient()
    qc.setQueryData(caseKeys.timeline("case1"), [doc("d1")])

    const cleanup = registerDocumentSocketHandlers(socket as never, qc)
    expect([...listeners.keys()].sort()).toEqual([
      "document:failed",
      "document:ready",
      "document:retrying",
      "document:started",
    ])

    listeners.get("document:ready")!(base)
    expect(qc.getQueryData<UserDocument[]>(caseKeys.timeline("case1"))![0]!.ragStatus).toBe("READY")

    cleanup()
    expect(listeners.size).toBe(0)
  })
})
