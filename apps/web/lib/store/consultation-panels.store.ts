import { create } from "zustand"

interface ConsultationPanelsState {
  /** Left ConsultationSidebar rail (desktop) — collapsed by default. */
  sidebarExpanded: boolean
  /** Right TopicNavigator rail (desktop) — open by default, since it only mounts once a split
   * reply is already on screen. */
  topicPanelExpanded: boolean
  setSidebarExpanded: (expanded: boolean) => void
  setTopicPanelExpanded: (expanded: boolean) => void
}

// Module-level (not component state) so the Consultation page's rails keep whatever the user
// last left them at across tab switches — ConsultationChat unmounts whenever the header nav
// moves to another tab, which used to reset both rails to their defaults on return. In memory
// only: a full reload starts from the defaults, which also keeps SSR and the first client
// render in agreement.
export const useConsultationPanelsStore = create<ConsultationPanelsState>()((set) => ({
  sidebarExpanded: false,
  topicPanelExpanded: true,
  setSidebarExpanded: (sidebarExpanded) => set({ sidebarExpanded }),
  setTopicPanelExpanded: (topicPanelExpanded) => set({ topicPanelExpanded }),
}))
