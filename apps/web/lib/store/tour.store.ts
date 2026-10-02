import { create } from "zustand"
import type { TourTargetId } from "@/lib/tour/steps"

/** How the open page tour started: on the user's first visit to the page, or from "Tour this
 * page" in Ask the guide. */
export type PageTourMode = "auto" | "manual"

/** A control the guide is pointing at, outside any tour step. */
export interface GuideSpot {
  target: TourTargetId
  route: string | null
  title: string
  body: string
}

export interface GuideMessage {
  id: string
  role: "user" | "guide"
  text: string
  /** Guide messages stream in word by word: how many characters are showing so far. */
  shown: number
  done: boolean
  highlight?: GuideSpot & { label: string }
  topic?: string
  /** A legal question — the guide offers to take it to Consultation instead. */
  handoff?: boolean
}

interface TourUiState {
  guideOpen: boolean
  setGuideOpen: (open: boolean) => void
  guideSpot: GuideSpot | null
  setGuideSpot: (spot: GuideSpot | null) => void
  /** The guide is hidden while it points at something; this pill brings it back. */
  guideMinimized: boolean
  setGuideMinimized: (minimized: boolean) => void
  messages: GuideMessage[]
  ask: (question: string, reply: Omit<GuideMessage, "id" | "role" | "shown" | "done">) => void
  /** The page tour running on this page, if any (see PageTour). */
  pageTour: PageTourMode | null
  setPageTour: (mode: PageTourMode | null) => void
  /** The guide asked the sample case page to start its tour for the tab being viewed. */
  sampleTourRequested: boolean
  setSampleTourRequested: (requested: boolean) => void
  clearGuide: () => void
  /** Back to a blank slate — on sign-out, so the next account in this tab starts fresh. */
  reset: () => void
}

const STREAM_DELAY_MS = 450
const STREAM_TICK_MS = 40
let streamTimer: ReturnType<typeof setInterval> | null = null
let messageSeq = 0

export const useTourStore = create<TourUiState>((set, get) => ({
  guideOpen: false,
  setGuideOpen: (guideOpen) => set({ guideOpen }),
  guideSpot: null,
  setGuideSpot: (guideSpot) => set({ guideSpot }),
  guideMinimized: false,
  setGuideMinimized: (guideMinimized) => set({ guideMinimized }),
  messages: [],
  pageTour: null,
  setPageTour: (pageTour) => set({ pageTour }),
  sampleTourRequested: false,
  setSampleTourRequested: (sampleTourRequested) => set({ sampleTourRequested }),

  ask: (question, reply) => {
    if (streamTimer) clearInterval(streamTimer)
    const id = `g${++messageSeq}`
    set((s) => ({
      messages: [
        // Any answer still streaming finishes instantly rather than being cut off.
        ...s.messages.map((m) => (m.done ? m : { ...m, shown: m.text.length, done: true })),
        { id: `u${messageSeq}`, role: "user", text: question, shown: question.length, done: true },
        { id, role: "guide", shown: 0, done: false, ...reply },
      ],
    }))

    // The answer is canned, so it's all there at once — streaming it a few words at a time just
    // reads like the rest of the app's chat instead of a wall of text appearing.
    setTimeout(() => {
      streamTimer = setInterval(() => {
        const msg = get().messages.find((m) => m.id === id)
        if (!msg) {
          if (streamTimer) clearInterval(streamTimer)
          return
        }
        const nextSpace = msg.text.indexOf(" ", msg.shown + 3)
        const shown = nextSpace < 0 ? msg.text.length : nextSpace
        const done = shown >= msg.text.length
        set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, shown, done } : m)) }))
        if (done && streamTimer) clearInterval(streamTimer)
      }, STREAM_TICK_MS)
    }, STREAM_DELAY_MS)
  },

  clearGuide: () => {
    if (streamTimer) clearInterval(streamTimer)
    set({ messages: [], guideSpot: null, guideMinimized: false })
  },

  reset: () => {
    if (streamTimer) clearInterval(streamTimer)
    set({ guideOpen: false, guideSpot: null, guideMinimized: false, messages: [], pageTour: null, sampleTourRequested: false })
  },
}))
