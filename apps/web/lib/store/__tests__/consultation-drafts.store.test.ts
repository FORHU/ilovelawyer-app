import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { useConsultationDraftsStore } from "../consultation-drafts.store"

const store = () => useConsultationDraftsStore.getState()

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
    useConsultationDraftsStore.setState({ drafts: {}, hydrated: false })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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
    useConsultationDraftsStore.setState({ drafts: {}, hydrated: false })
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

  it("keeps Cases apart", () => {
    store().ensureDraft("case-1")
    store().ensureDraft("case-2")
    store().updateDraft("case-2", { title: "Scotland" })
    expect(store().drafts["case-1"]?.title).toBe("")
    expect(store().drafts["case-2"]?.title).toBe("Scotland")
  })

  it("ignores corrupt storage instead of throwing", () => {
    vi.stubGlobal("localStorage", memoryStorage({ consultationDrafts: "{not json" }))
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
