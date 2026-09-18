import { create } from "zustand"

/** Which evidence-quote/decision-anchor span (see use-topic-navigator.ts's
 * evidenceQuoteElementId/decisionAnchorElementId) is currently highlighted yellow in the chat
 * transcript — set by SourcesPanel's Evidence/Authorities rows when clicked, one at a time (a
 * new click replaces the last highlight rather than accumulating). Same sibling-panels problem
 * as sending-consultations.store.ts: SourcesPanel and ConsultationChat aren't in the same render
 * tree (both are children of case-workspace.tsx), so this can't just be local component state. */
interface ActiveHighlightState {
  activeHighlightId: string | null
  setActiveHighlight: (id: string | null) => void
}

export const useActiveHighlightStore = create<ActiveHighlightState>((set) => ({
  activeHighlightId: null,
  setActiveHighlight: (id) => set({ activeHighlightId: id }),
}))
