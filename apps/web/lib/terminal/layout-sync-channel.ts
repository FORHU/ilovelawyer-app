import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react"
import type { WorkspaceLayout } from "@/lib/terminal/types"
import { applyScreenClosedFallback } from "@/lib/terminal/multi-screen"

// One channel per case — every window (primary + every canvas window) viewing the same case joins
// the same channel, so a layout edit or a window closing anywhere is reflected everywhere else
// near-instantly, instead of waiting on useCanvasWindowReaper's 500ms poll or a manual reload. BroadcastChannel never delivers a message back to the context that posted it (spec
// guaranteed), so no self-echo filtering is needed here.
function channelName(caseId: string): string {
  return `terminal-sync:${caseId}`
}

export type SyncMessage =
  | { type: "layout"; layoutJson: WorkspaceLayout; workspaceId: string }
  | { type: "screen-closing"; screenIndex: number }
  | { type: "request-layout" }

// Shared by legal-terminal.tsx and the canvas route — both maintain the same shape of local
// layout state (layout/setLayout, lastSavedLayoutRef, canvasWindowsRef), so one hook covers both.
// Additive to the existing poll, not a replacement: a window that never receives a broadcast
// (opened after the fact, or BroadcastChannel unsupported) still gets caught by the poll
// eventually.
//
// A freshly-opened window has an inherent gap: BroadcastChannel doesn't replay past messages, so a
// broadcast sent before this window's own channel finishes subscribing is simply lost — the exact
// case of "just opened a canvas window, it doesn't have the panel that was just sent to it yet".
// Fixed with a small request/response handshake: on mount, this hook posts "request-layout"; any
// OTHER window that already has a real `layout` responds by re-broadcasting its current state,
// which this window then adopts like any other "layout" message. Whichever window responds first
// wins in practice; a second response for the same content is a harmless no-op.
export function useLayoutSyncChannel({
  caseId,
  workspaceId,
  layout,
  setLayout,
  lastSavedLayoutRef,
  canvasWindowsRef,
  setWorkspaceId,
}: {
  caseId: string
  workspaceId: string
  layout: WorkspaceLayout | null
  setLayout: Dispatch<SetStateAction<WorkspaceLayout | null>>
  lastSavedLayoutRef: React.RefObject<string>
  canvasWindowsRef: React.RefObject<Map<number, Window>>
  /** A canvas window opened before the primary's brand-new workspace finished being created can
   * find nothing on its own initial fetch and never establish a workspaceId at all (see the
   * "layout" case below) — passing this lets it adopt whichever workspace a later broadcast turns
   * out to belong to, instead of being stuck rejecting every future "layout" message forever.
   * legal-terminal.tsx doesn't need this: the primary window is always the one that creates and
   * already knows its own workspaceId, never adopts one from a broadcast. */
  setWorkspaceId?: Dispatch<SetStateAction<string>>
}): { broadcastLayout: (layoutJson: WorkspaceLayout) => void } {
  const channelRef = useRef<BroadcastChannel | null>(null)
  // Read inside the message handler without re-subscribing on every change — this hook's own
  // effect only re-runs on `caseId`.
  const workspaceIdRef = useRef(workspaceId)
  useEffect(() => {
    workspaceIdRef.current = workspaceId
  }, [workspaceId])
  const layoutRef = useRef(layout)
  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return
    const channel = new BroadcastChannel(channelName(caseId))
    channelRef.current = channel

    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      const msg = event.data
      switch (msg.type) {
        case "layout": {
          // A window that has ALREADY loaded a specific workspace shouldn't silently adopt a
          // different one's content. But a window with no workspaceId of its own yet (a canvas
          // window opened right as a brand-new workspace was still being created, whose own
          // initial fetch found nothing to load — see the "no workspace yet" bootstrap effect)
          // isn't "on a different workspace", it's on NONE yet, and should adopt whatever shows up
          // rather than reject every broadcast forever.
          if (workspaceIdRef.current && msg.workspaceId !== workspaceIdRef.current) return
          if (!workspaceIdRef.current) {
            workspaceIdRef.current = msg.workspaceId
            setWorkspaceId?.(msg.workspaceId)
          }
          // Set BEFORE setLayout — this is what prevents a save/broadcast feedback loop, since
          // the receiving window's own debounced-save effect compares JSON.stringify(layout)
          // against lastSavedLayoutRef.current and skips saving when they already match.
          lastSavedLayoutRef.current = JSON.stringify(msg.layoutJson)
          setLayout(msg.layoutJson)
          return
        }
        case "screen-closing": {
          canvasWindowsRef.current.delete(msg.screenIndex)
          setLayout((prev) => (prev ? applyScreenClosedFallback(prev, msg.screenIndex) : prev))
          return
        }
        case "request-layout": {
          const current = layoutRef.current
          if (current && workspaceIdRef.current) {
            channel.postMessage({ type: "layout", layoutJson: current, workspaceId: workspaceIdRef.current } satisfies SyncMessage)
          }
          return
        }
      }
    }

    // Catches the exact race a brand-new window is prone to: ask whoever's already out there for
    // the current state, rather than hoping to catch a broadcast timed just right.
    channel.postMessage({ type: "request-layout" } satisfies SyncMessage)

    return () => {
      channel.close()
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs only; workspaceId/layout read via refs
  }, [caseId])

  // Stable identity (refs only in its closure) so callers can safely list it in a useEffect
  // dependency array without retriggering that effect on every render.
  const broadcastLayout = useCallback((layoutJson: WorkspaceLayout) => {
    channelRef.current?.postMessage({ type: "layout", layoutJson, workspaceId: workspaceIdRef.current } satisfies SyncMessage)
  }, [])

  return { broadcastLayout }
}

// One-shot sender for a window that is itself about to unload (pagehide) and wants to announce it
// instantly rather than let the poll discover it up to 500ms later. Opens a channel, posts, closes
// it immediately — no need to keep it open for a single message.
export function announceWindowClosing(caseId: string, message: { type: "screen-closing"; screenIndex: number }): void {
  if (typeof BroadcastChannel === "undefined") return
  const channel = new BroadcastChannel(channelName(caseId))
  channel.postMessage(message satisfies SyncMessage)
  channel.close()
}
