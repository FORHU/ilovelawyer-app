import { describe, expect, it } from "vitest"
import { activeWorkspaceId, SHARED_WORKSPACE_PATH } from "@/lib/store/auth.store"
import { workspaceIdForRequest } from "@/lib/fetch"

const organization = { id: "org" } as never
const portfolio = { id: "my-portfolio" } as never
const shared = { id: "alice-portfolio", ownerName: "Alice" }

describe("the shared workspace — someone else's portfolio, opened through a read-only share", () => {
  it("is where requests go while a shared case is open", () => {
    expect(activeWorkspaceId({ organization, portfolio, workspace: "shared", shared })).toBe("alice-portfolio")
  })

  it("sends only the APIs a share reaches to the owner's portfolio", () => {
    const state = { organization, portfolio, workspace: "shared" as const, shared }
    for (const path of ["/api/my-cases/c1", "/api/my-cases", "/api/terminal/workspaces?caseId=c1", "/api/documents?caseId=c1", "/api/transcriptions/t1", "/api/chat/consultations?caseId=c1"]) {
      expect(workspaceIdForRequest(path, state), path).toBe("alice-portfolio")
    }
    for (const path of ["/api/notifications", "/api/organizations", "/api/shared-cases", "/api/my-cases-export", "/api/law/search"]) {
      expect(workspaceIdForRequest(path, state), path).toBe("org")
    }
  })

  it("changes nothing outside a share", () => {
    expect(workspaceIdForRequest("/api/notifications", { organization, portfolio, workspace: "portfolio", shared: null })).toBe("my-portfolio")
    expect(workspaceIdForRequest("/api/my-cases", { organization, portfolio, workspace: "organization", shared: null })).toBe("org")
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
