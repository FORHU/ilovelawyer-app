import { describe, expect, it } from "vitest"
import { activeWorkspaceId, ownWorkspace, SHARED_WORKSPACE_PATH } from "@/lib/store/auth.store"
import { workspaceIdForRequest } from "@/lib/fetch"

const organization = { id: "org" } as never
const portfolio = ownWorkspace("UK", "Me")
const shared = { id: "user:alice", ownerName: "Alice" }

describe("the shared workspace — someone else's portfolio, opened through a read-only share", () => {
  it("is where requests go while a shared case is open", () => {
    expect(activeWorkspaceId({ organization, portfolio, workspace: "shared", shared })).toBe("user:alice")
  })

  it("sends only the APIs a share reaches to the owner's portfolio", () => {
    const state = { organization, portfolio, workspace: "shared" as const, shared }
    for (const path of ["/api/my-cases/c1", "/api/my-cases", "/api/terminal/workspaces?caseId=c1", "/api/documents?caseId=c1", "/api/transcriptions/t1", "/api/chat/consultations?caseId=c1"]) {
      expect(workspaceIdForRequest(path, state), path).toBe("user:alice")
    }
    for (const path of ["/api/notifications", "/api/organizations", "/api/shared-cases", "/api/my-cases-export", "/api/law/search"]) {
      expect(workspaceIdForRequest(path, state), path).toBe("org")
    }
  })

  it("changes nothing outside a share", () => {
    // The lawyer's own workspace has no organization: no X-Organization-Id (ilovelawyer-api docs/adr/0022).
    expect(workspaceIdForRequest("/api/notifications", { organization, portfolio, workspace: "portfolio", shared: null })).toBeNull()
    expect(workspaceIdForRequest("/api/my-cases", { organization, portfolio, workspace: "organization", shared: null })).toBe("org")
  })

  it("sends no X-Organization-Id for a solo lawyer, whose own workspace is their only one", () => {
    const own = ownWorkspace("PH", "Solo")
    expect(workspaceIdForRequest("/api/my-cases", { organization: own, portfolio: null, workspace: "organization", shared: null })).toBeNull()
    expect(workspaceIdForRequest("/api/my-cases", { organization: own, portfolio: null, workspace: "shared", shared })).toBe("user:alice")
    expect(workspaceIdForRequest("/api/notifications", { organization: own, portfolio: null, workspace: "shared", shared })).toBeNull()
  })

  it("opens only on a case's own pages: the case page and its Terminal", () => {
    expect(SHARED_WORKSPACE_PATH.test("/homepage/case-portfolio/c1")).toBe(true)
    expect(SHARED_WORKSPACE_PATH.test("/homepage/terminal/c1")).toBe(true)
    expect(SHARED_WORKSPACE_PATH.test("/homepage/terminal/c1/canvas/2")).toBe(true)
    expect(SHARED_WORKSPACE_PATH.test("/homepage/case-portfolio")).toBe(false)
    expect(SHARED_WORKSPACE_PATH.test("/homepage/terminal")).toBe(false)
    expect(SHARED_WORKSPACE_PATH.test("/homepage/calendar")).toBe(false)
  })
})
