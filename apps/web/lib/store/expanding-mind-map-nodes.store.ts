import { create } from "zustand"

/** Mind map nodes with an "Expand with AI" request in flight, keyed `${consultationId}:${nodeId}`.
 * A store rather than component state because the same map renders in two places (the chat's
 * Mind Map tab and Studio's Mind Map panel) and either can remount mid-request (layout switch,
 * tab change, fullscreen) — the node's loading shimmer has to survive that. */
interface ExpandingMindMapNodesState {
  expandingKeys: Set<string>
  start: (key: string) => void
  stop: (key: string) => void
}

export const mindMapNodeKey = (consultationId: string, nodeId: string) => `${consultationId}:${nodeId}`

export const useExpandingMindMapNodesStore = create<ExpandingMindMapNodesState>((set) => ({
  expandingKeys: new Set(),
  start: (key) => set((state) => ({ expandingKeys: new Set(state.expandingKeys).add(key) })),
  stop: (key) =>
    set((state) => {
      if (!state.expandingKeys.has(key)) return state
      const next = new Set(state.expandingKeys)
      next.delete(key)
      return { expandingKeys: next }
    }),
}))
