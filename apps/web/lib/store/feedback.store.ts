import { create } from "zustand"

/** Open/closed state for the header's Feedback drawer, so the desktop header pill and the mobile
 * menu entry open the exact same drawer (mounted once, in the protected layout). */
interface FeedbackState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
