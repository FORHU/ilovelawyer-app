import { create } from "zustand"

/** Which consultations currently have a reply in flight — a topic breakdown (see
 * lib/chat/use-topic-navigator.ts) can only exist once persisted, so its panel has nothing
 * to show until the turn finishes. This lets that panel show a "generating" state the moment
 * a send starts instead of looking empty/stale, even when the panel is a sibling of
 * ConsultationChat (Case Workspace's left panel) rather than inside its own render tree,
 * where `isSending` state isn't otherwise reachable. */
interface SendingConsultationsState {
  sendingConsultationIds: Set<string>
  startSending: (consultationId: string) => void
  stopSending: (consultationId: string) => void
}

export const useSendingConsultationsStore = create<SendingConsultationsState>((set) => ({
  sendingConsultationIds: new Set(),
  startSending: (consultationId) =>
    set((state) => ({ sendingConsultationIds: new Set(state.sendingConsultationIds).add(consultationId) })),
  stopSending: (consultationId) =>
    set((state) => {
      if (!state.sendingConsultationIds.has(consultationId)) return state;
      const next = new Set(state.sendingConsultationIds);
      next.delete(consultationId);
      return { sendingConsultationIds: next };
    }),
}))
