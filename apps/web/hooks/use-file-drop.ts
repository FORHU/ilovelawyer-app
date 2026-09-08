"use client"

import { useRef, useState } from "react"

/** HTML5 drag-and-drop onto a single target, e.g. a folder card. Tracks drag-enter/leave with a
 * counter (not a plain boolean) so a child element's own enter/leave inside the target doesn't
 * flicker `isDragOver` off before the drag actually leaves the target itself. */
export function useFileDrop(onFiles: (files: File[]) => void) {
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)

  const dragHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault()
      dragCounter.current += 1
      setIsDragOver(true)
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault()
      dragCounter.current -= 1
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setIsDragOver(false)
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      dragCounter.current = 0
      setIsDragOver(false)
      if (e.dataTransfer.files?.length) onFiles(Array.from(e.dataTransfer.files))
    },
  }

  return { isDragOver, dragHandlers }
}
