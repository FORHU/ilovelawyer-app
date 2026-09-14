"use client"

import { useRef, useState } from "react"

/** HTML5 drag-and-drop across a whole container that may itself hold multiple distinct upload
 * destinations (e.g. per-folder cards inside a Documents grid). Tracks drag-enter/leave with a
 * counter (not a plain boolean) so a nested child's own enter/leave events don't flicker
 * `isDragOver` off before the drag actually leaves the container itself — that flicker is the
 * usual failure mode when a drop zone contains child elements with their own borders/padding.
 *
 * Each drop's actual destination is resolved from the real element under the pointer: elements
 * that represent a specific destination (e.g. a folder card) carry `data-drop-target`, and the
 * nearest one up the tree from `event.target` wins. Dropping anywhere else in the container
 * (grid background, loose file cards, an empty state) falls back to `defaultTarget`, so the
 * caller doesn't need its own per-child drop handling to cover the rest of the surface. */
export function useFileDrop(
  onFiles: (files: File[], target: string | undefined) => void,
  defaultTarget: string | undefined,
) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [hoverTarget, setHoverTarget] = useState<string | undefined>(undefined)
  const dragCounter = useRef(0)

  const resolveTarget = (e: React.DragEvent): string | undefined => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-drop-target]")
    return el?.dataset.dropTarget || defaultTarget
  }

  const dragHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current += 1
      setIsDragOver(true)
      setHoverTarget(resolveTarget(e))
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setHoverTarget(resolveTarget(e))
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current -= 1
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setIsDragOver(false)
        setHoverTarget(undefined)
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const target = resolveTarget(e)
      dragCounter.current = 0
      setIsDragOver(false)
      setHoverTarget(undefined)
      if (e.dataTransfer.files?.length) onFiles(Array.from(e.dataTransfer.files), target)
    },
  }

  return { isDragOver, hoverTarget, dragHandlers }
}
