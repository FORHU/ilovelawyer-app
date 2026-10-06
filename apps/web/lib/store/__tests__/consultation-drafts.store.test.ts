import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { useConsultationDraftsStore } from "../consultation-drafts.store"
import { useAuthStore } from "../auth.store"

const store = () => useConsultationDraftsStore.getState()

function signIn(id: string) {
  useAuthStore.setState({ user: { id, username: id, email: `${id}@example.com` } })
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    raw: () => data.get("consultationDrafts"),
  }
}

describe("consultation drafts store", () => {
  let storage: ReturnType<typeof memoryStorage>

  beforeEach(() => {
    storage = memoryStorage()
    vi.stubGlobal("localStorage", storage)
    useConsultationDraftsStore.setState({ ownerId: null, drafts: {}, hydrated: false })
    signIn("user-a")
    store().hydrate()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useAuthStore.setState({ user: null })
  })

  it("keeps one draft per Case: ensureDraft never resets an existing one", () => {
    store().ensureDraft("case-1")
    store().updateDraft("case-1", { title: "Remedies", text: "What damages" })
    store().ensureDraft("case-1")
    expect(store().drafts["case-1"]).toMatchObject({ title: "Remedies", text: "What damages" })
  })

  it("survives a reload: what was saved is read back by hydrate", () => {
    store().ensureDraft("case-1")
    store().updateDraft("case-1", { text: "half-typed question" })
    useConsultationDraftsStore.setState({ ownerId: null, drafts: {}, hydrated: false })
    store().hydrate()
    expect(store().hydrated).toBe(true)
    expect(store().drafts["case-1"]?.text).toBe("half-typed question")
  })

  it("does not bring a draft back once cleared — a late keystroke after the first send is dropped", () => {
    store().ensureDraft("case-1")
    store().clearDraft("case-1")
    store().updateDraft("case-1", { text: "late" })
    expect(store().drafts["case-1"]).toBeUndefined()
    expect(JSON.parse(storage.raw()!)).toEqual({})
  })

  it("never shows one account's drafts to the next account signed in on this browser", () => {
    store().ensureDraft("case-1")
    store().updateDraft("case-1", { text: "privileged" })
    signIn("user-b")
    store().hydrate()
    expect(store().drafts["case-1"]).toBeUndefined()
    store().ensureDraft("case-1")
    store().updateDraft("case-1", { text: "b's own" })
    signIn("user-a")
    store().hydrate()
    expect(store().drafts["case-1"]?.text).toBe("privileged")
  })

  it("empties itself, without reading anyone's drafts, while nobody is signed in", () => {
    store().ensureDraft("case-1")
    useAuthStore.setState({ user: null })
    store().hydrate()
    expect(store().hydrated).toBe(false)
    expect(store().drafts).toEqual({})
  })

  it("deletes the signed-out account's drafts from storage and keeps other accounts'", () => {
    signIn("user-b")
    store().hydrate()
    store().ensureDraft("case-1")
    store().updateDraft("case-1", { text: "b's" })
    signIn("user-a")
    store().hydrate()
    store().ensureDraft("case-1")
    store().updateDraft("case-1", { text: "a's" })
    store().discardAll()
    expect(store().drafts).toEqual({})
    const saved = JSON.parse(storage.raw()!)
    expect(saved["user-a"]).toBeUndefined()
    expect(saved["user-b"]["case-1"].text).toBe("b's")
  })

  it("keeps Cases apart", () => {
    store().ensureDraft("case-1")
    store().ensureDraft("case-2")
    store().updateDraft("case-2", { title: "Scotland" })
    expect(store().drafts["case-1"]?.title).toBe("")
    expect(store().drafts["case-2"]?.title).toBe("Scotland")
  })

  it("ignores corrupt storage instead of throwing", () => {
    vi.stubGlobal("localStorage", memoryStorage({ consultationDrafts: "{not json" }))
    useConsultationDraftsStore.setState({ ownerId: null, drafts: {}, hydrated: false })
    store().hydrate()
    expect(store().drafts).toEqual({})
  })

  it("still works in memory when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
    })
    store().hydrate()
    store().ensureDraft("case-1")
    store().updateDraft("case-1", { text: "still here" })
    expect(store().drafts["case-1"]?.text).toBe("still here")
  })
})
