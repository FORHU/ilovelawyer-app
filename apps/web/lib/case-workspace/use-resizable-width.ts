"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseResizableWidthOptions {
  /** localStorage key this panel's dragged width persists under — scope it per panel
   * (e.g. "case-workspace:sources-width") so Sources and Studio don't clobber each other. */
  storageKey: string;
  defaultWidth: number;
  min: number;
  max: number;
  /** Which drag direction grows this panel: Sources sits left of its handle (dragging right,
   * +1, grows it), Studio sits right of its handle (dragging left, -1, grows it). */
  direction: 1 | -1;
  /** Re-evaluated on every pointermove (not memoized) so it can react to the live container
   * width and the sibling panel's current width — caps this panel's width so the center chat
   * column can never be crushed below its own minimum. Static `max` still applies on top. */
  getDynamicMax?: () => number;
}

/** Drag-to-resize width for one Case Workspace sidebar, with persisted width, min/max
 * clamping, and a body-level cursor/selection lock while dragging. Modeled after NotebookLM's
 * resizable Sources/Studio panels (see case-workspace.tsx). Collapse/expand is tracked
 * separately by the caller — this hook only owns the *expanded* width, so toggling collapsed
 * never loses the user's custom size. */
export function useResizableWidth({ storageKey, defaultWidth, min, max, direction, getDynamicMax }: UseResizableWidthOptions) {
  const [width, setWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Restored after the first render (not as the initial state) so server and first client
  // render both use `defaultWidth` — reading localStorage during render would mismatch SSR.
  useEffect(() => {
    let restored = defaultWidth;
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved ? Number(saved) : NaN;
      if (Number.isFinite(parsed)) restored = Math.min(max, Math.max(min, parsed));
    } catch {
      // localStorage unavailable (private browsing, storage disabled) — stick with the default
    }
    // Batched into one render, so the persist effect below never sees `hydrated: true` paired
    // with the stale pre-restore `width` — otherwise it would write `defaultWidth` straight
    // over a previously saved custom size the instant this component mounts.
    setWidth(restored);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clamp = useCallback(
    (value: number) => {
      const dynamicMax = getDynamicMax ? Math.min(max, getDynamicMax()) : max;
      return Math.min(dynamicMax, Math.max(min, value));
    },
    [min, max, getDynamicMax],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragStateRef.current = { startX: e.clientX, startWidth: width };
      setIsDragging(true);
    },
    [width],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const delta = (e.clientX - drag.startX) * direction;
      setWidth(clamp(drag.startWidth + delta));
    };
    const handlePointerUp = () => {
      setIsDragging(false);
      dragStateRef.current = null;
    };

    // Tracked on `document` (not the handle itself) so the drag keeps following the pointer
    // even once it moves off the thin divider mid-drag.
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };
  }, [isDragging, direction, clamp]);

  // Persists once a drag settles (not on every pointermove tick) — gated on `hydrated` so the
  // very first render's default value never overwrites an already-saved custom width.
  useEffect(() => {
    if (!hydrated || isDragging) return;
    try {
      localStorage.setItem(storageKey, String(width));
    } catch {
      // localStorage unavailable — resizing still works this session, it just won't persist
    }
  }, [hydrated, isDragging, width, storageKey]);

  return { width, isDragging, handlePointerDown };
}
