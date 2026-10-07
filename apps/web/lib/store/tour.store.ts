import { create } from "zustand"
import type { GuidePathStep, TourTargetId } from "@/lib/tour/steps"
import type { SampleTourTrack } from "@/lib/sample-case/tours"

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
  /** The steps to a feature that needs a prerequisite, marked off so far. */
  path?: GuidePathStep[]
  /** A sample-case tour that shows the feature before the user can reach it. */
  sample?: SampleTourTrack
}

export type GuideReply = Omit<GuideMessage, "id" | "role" | "shown" | "done">

interface TourUiState {
  guideOpen: boolean
  setGuideOpen: (open: boolean) => void
  guideSpot: GuideSpot | null
  setGuideSpot: (spot: GuideSpot | null) => void
  /** The guide is hidden while it points at something; this pill brings it back. */
  guideMinimized: boolean
  setGuideMinimized: (minimized: boolean) => void
  messages: GuideMessage[]
  ask: (question: string, reply: GuideReply) => void
  /** A guide message nobody asked for: the next step, once a prerequisite is met. */
  follow: (reply: GuideReply) => void
  /** An answer the guide is waiting to give: the user asked about a feature that needs a
   * prerequisite first. TourLayer gives it once the prerequisite is met. */
  pendingGoal: { answerId: string } | null
  setPendingGoal: (goal: { answerId: string } | null) => void
  /** A next step is waiting in the guide — its minimized pill says so. */
  guideNudge: boolean
  setGuideNudge: (nudge: boolean) => void
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
let streamDelay: ReturnType<typeof setTimeout> | null = null

/** Stops the message streaming in, if any — before the next one starts, or on a reset. */
function stopStreaming() {
  if (streamDelay) clearTimeout(streamDelay)
  if (streamTimer) clearInterval(streamTimer)
  streamDelay = null
  streamTimer = null
}
let messageSeq = 0

/** Shows guide message `id` a few words at a time. The answer is canned, so it's all there at
 * once — streaming it just reads like the rest of the app's chat instead of a wall of text. */
function streamIn(id: string, get: () => TourUiState, set: (fn: (s: TourUiState) => Partial<TourUiState>) => void) {
  stopStreaming()
  streamDelay = setTimeout(() => {
    streamDelay = null
    // Each interval clears itself, never whichever one the module variable holds by then.
    const timer = setInterval(() => {
      const msg = get().messages.find((m) => m.id === id)
      if (!msg) {
        clearInterval(timer)
        return
      }
      const nextSpace = msg.text.indexOf(" ", msg.shown + 3)
      const shown = nextSpace < 0 ? msg.text.length : nextSpace
      const done = shown >= msg.text.length
      set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, shown, done } : m)) }))
      if (done) clearInterval(timer)
    }, STREAM_TICK_MS)
    streamTimer = timer
  }, STREAM_DELAY_MS)
}

/** Any answer still streaming finishes instantly rather than being cut off. */
const finishStreaming = (messages: GuideMessage[]) => messages.map((m) => (m.done ? m : { ...m, shown: m.text.length, done: true }))

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
  pendingGoal: null,
  setPendingGoal: (pendingGoal) => set({ pendingGoal }),
  guideNudge: false,
  setGuideNudge: (guideNudge) => set({ guideNudge }),

  ask: (question, reply) => {
    stopStreaming()
    const id = `g${++messageSeq}`
    set((s) => ({
      messages: [
        ...finishStreaming(s.messages),
        { id: `u${messageSeq}`, role: "user", text: question, shown: question.length, done: true },
        { id, role: "guide", shown: 0, done: false, ...reply },
      ],
    }))
    streamIn(id, get, set)
  },

  follow: (reply) => {
    stopStreaming()
    const id = `g${++messageSeq}`
    set((s) => ({ messages: [...finishStreaming(s.messages), { id, role: "guide", shown: 0, done: false, ...reply }] }))
    streamIn(id, get, set)
  },

  clearGuide: () => {
    stopStreaming()
    set({ messages: [], guideSpot: null, guideMinimized: false, pendingGoal: null, guideNudge: false })
  },

  reset: () => {
    stopStreaming()
    set({
      guideOpen: false,
      guideSpot: null,
      guideMinimized: false,
      messages: [],
      pageTour: null,
      sampleTourRequested: false,
      pendingGoal: null,
      guideNudge: false,
    })
  },
}))
