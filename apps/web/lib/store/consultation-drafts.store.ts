import { useEffect } from "react"
import { create } from "zustand"

/** A Case's not-yet-saved Consultation: what "New consultation" opens at `?c=new`. Kept only in
 * this browser — no database row exists until the first message (or file) is sent, so a
 * Consultation nobody wrote in never shows up for anyone. One per Case: "New consultation" while
 * one exists reopens it rather than stacking another. */
export interface ConsultationDraft {
  title: string
  /** The composer's unsent text, restored when the user comes back to the draft. */
  text: string
  updatedAt: number
}

const STORAGE_KEY = "consultationDrafts"

interface ConsultationDraftsState {
  /** caseId → its draft. */
  drafts: Record<string, ConsultationDraft>
  /** False until hydrate() has read localStorage — readers wait for it instead of treating "not
   * loaded yet" as "no draft". */
  hydrated: boolean
  hydrate: () => void
  /** Creates the Case's draft if it has none; a no-op otherwise (an existing one keeps its text). */
  ensureDraft: (caseId: string) => void
  /** Patches an existing draft; a no-op when the Case has none, so a late keystroke landing after
   * the draft was turned into a real Consultation can't bring it back. */
  updateDraft: (caseId: string, patch: Partial<Pick<ConsultationDraft, "title" | "text">>) => void
  clearDraft: (caseId: string) => void
}

// Every storage touch is wrapped: a private window, blocked site data, or a full quota must only
// cost the draft's persistence, never the chat.
function read(): Record<string, ConsultationDraft> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return {}
    const drafts: Record<string, ConsultationDraft> = {}
    for (const [caseId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) continue
      const v = value as Partial<ConsultationDraft>
      drafts[caseId] = {
        title: typeof v.title === "string" ? v.title : "",
        text: typeof v.text === "string" ? v.text : "",
        updatedAt: typeof v.updatedAt === "number" ? v.updatedAt : Date.now(),
      }
    }
    return drafts
  } catch {
    return {}
  }
}

function write(drafts: Record<string, ConsultationDraft>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
  } catch {
    // See read() — persistence is best-effort.
  }
}

// Starts empty (not read from localStorage) so server-rendered markup and the client's first render
// agree; useConsultationDraft hydrates after mount. Same idiom as terminal-display.store.ts.
export const useConsultationDraftsStore = create<ConsultationDraftsState>()((set, get) => {
  const commit = (drafts: Record<string, ConsultationDraft>) => {
    write(drafts)
    set({ drafts })
  }
  return {
    drafts: {},
    hydrated: false,
    hydrate: () => {
      if (get().hydrated) return
      set({ drafts: { ...read(), ...get().drafts }, hydrated: true })
    },
    ensureDraft: (caseId) => {
      const { drafts } = get()
      if (drafts[caseId]) return
      commit({ ...drafts, [caseId]: { title: "", text: "", updatedAt: Date.now() } })
    },
    updateDraft: (caseId, patch) => {
      const { drafts } = get()
      const current = drafts[caseId]
      if (!current) return
      if ((patch.title ?? current.title) === current.title && (patch.text ?? current.text) === current.text) return
      commit({ ...drafts, [caseId]: { ...current, ...patch, updatedAt: Date.now() } })
    },
    clearDraft: (caseId) => {
      const { drafts } = get()
      if (!drafts[caseId]) return
      const next = { ...drafts }
      delete next[caseId]
      commit(next)
    },
  }
})

/** The Case's draft (undefined when it has none), hydrating from localStorage on first use. */
export function useConsultationDraft(caseId: string | undefined) {
  const hydrated = useConsultationDraftsStore((s) => s.hydrated)
  const hydrate = useConsultationDraftsStore((s) => s.hydrate)
  useEffect(() => {
    hydrate()
  }, [hydrate])
  const draft = useConsultationDraftsStore((s) => (caseId ? s.drafts[caseId] : undefined))
  return { draft, hydrated }
}
