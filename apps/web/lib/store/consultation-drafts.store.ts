import { useEffect } from "react"
import { create } from "zustand"
import { useAuthStore } from "@/lib/store/auth.store"

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

/** What's stored: userId → caseId → draft. localStorage is shared by every account signed in on
 * this browser, and a draft can hold privileged text — each account only ever loads its own. */
type StoredDrafts = Record<string, Record<string, ConsultationDraft>>

interface ConsultationDraftsState {
  /** Whose drafts `drafts` holds — the signed-in user they were hydrated for. */
  ownerId: string | null
  /** caseId → its draft, for `ownerId` only. */
  drafts: Record<string, ConsultationDraft>
  /** False until hydrate() has read the signed-in user's drafts from localStorage — readers wait
   * for it instead of treating "not loaded yet" as "no draft". */
  hydrated: boolean
  /** Loads the signed-in user's drafts; re-run when that user changes (see useConsultationDraft). */
  hydrate: () => void
  /** Creates the Case's draft if it has none; a no-op otherwise (an existing one keeps its text). */
  ensureDraft: (caseId: string) => void
  /** Patches an existing draft; a no-op when the Case has none, so a late keystroke landing after
   * the draft was turned into a real Consultation can't bring it back. */
  updateDraft: (caseId: string, patch: Partial<Pick<ConsultationDraft, "title" | "text">>) => void
  clearDraft: (caseId: string) => void
  /** Deletes the current owner's drafts from this browser — on sign-out, so a shared computer
   * keeps nothing of theirs behind. */
  discardAll: () => void
}

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null
}

function parseDraft(value: unknown): ConsultationDraft | null {
  if (typeof value !== "object" || value === null) return null
  const v = value as Partial<ConsultationDraft>
  return {
    title: typeof v.title === "string" ? v.title : "",
    text: typeof v.text === "string" ? v.text : "",
    updatedAt: typeof v.updatedAt === "number" ? v.updatedAt : Date.now(),
  }
}

// Every storage touch is wrapped: a private window, blocked site data, or a full quota must only
// cost the draft's persistence, never the chat.
function readAll(): StoredDrafts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return {}
    const all: StoredDrafts = {}
    for (const [userId, cases] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof cases !== "object" || cases === null) continue
      const drafts: Record<string, ConsultationDraft> = {}
      for (const [caseId, value] of Object.entries(cases as Record<string, unknown>)) {
        const draft = parseDraft(value)
        if (draft) drafts[caseId] = draft
      }
      all[userId] = drafts
    }
    return all
  } catch {
    return {}
  }
}

/** Replaces one user's drafts, leaving other accounts' untouched. */
function writeOwner(ownerId: string, drafts: Record<string, ConsultationDraft>) {
  try {
    const all = readAll()
    if (Object.keys(drafts).length > 0) all[ownerId] = drafts
    else delete all[ownerId]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // See readAll() — persistence is best-effort.
  }
}

// Starts empty (not read from localStorage) so server-rendered markup and the client's first render
// agree; useConsultationDraft hydrates after mount. Same idiom as terminal-display.store.ts.
export const useConsultationDraftsStore = create<ConsultationDraftsState>()((set, get) => {
  // Drafts made before hydration (no owner known yet) stay in memory only until hydrate()
  // merges them into the owner's.
  const commit = (drafts: Record<string, ConsultationDraft>) => {
    const { ownerId } = get()
    if (ownerId) writeOwner(ownerId, drafts)
    set({ drafts })
  }
  return {
    ownerId: null,
    drafts: {},
    hydrated: false,
    hydrate: () => {
      const userId = currentUserId()
      const { ownerId, hydrated, drafts } = get()
      if (!userId) {
        // Signed out: nothing of the previous account's may stay on screen.
        if (ownerId || hydrated) set({ ownerId: null, drafts: {}, hydrated: false })
        return
      }
      if (hydrated && ownerId === userId) return
      // A different account than the one loaded: start from theirs alone.
      const carried = ownerId === null ? drafts : {}
      const merged = { ...(readAll()[userId] ?? {}), ...carried }
      set({ ownerId: userId, drafts: merged, hydrated: true })
      if (Object.keys(carried).length > 0) writeOwner(userId, merged)
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
    discardAll: () => {
      const ownerId = get().ownerId ?? currentUserId()
      if (ownerId) writeOwner(ownerId, {})
      set({ ownerId: null, drafts: {}, hydrated: false })
    },
  }
})

/** The Case's draft (undefined when it has none), hydrating the signed-in user's drafts from
 * localStorage on first use and again whenever a different user signs in. */
export function useConsultationDraft(caseId: string | undefined) {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const hydrated = useConsultationDraftsStore((s) => s.hydrated)
  const hydrate = useConsultationDraftsStore((s) => s.hydrate)
  useEffect(() => {
    hydrate()
  }, [hydrate, userId])
  const draft = useConsultationDraftsStore((s) => (caseId ? s.drafts[caseId] : undefined))
  return { draft, hydrated }
}
