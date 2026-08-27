"use client";

interface ResizeHandleProps {
  onPointerDown: (e: React.PointerEvent) => void;
  isDragging: boolean;
  ariaLabel: string;
}

/** Vertical drag divider between Case Workspace panels — a slim hit target with a centered
 * line that tints on hover/drag, `col-resize` cursor throughout. Purely presentational; the
 * actual width math lives in use-resizable-width.ts. */
export function ResizeHandle({ onPointerDown, isDragging, ariaLabel }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      className="group relative flex h-full w-1.5 shrink-0 cursor-col-resize touch-none select-none items-stretch justify-center"
    >
      <div
        className={`w-px transition-colors ${isDragging ? "bg-primary/70" : "bg-transparent group-hover:bg-primary/50"}`}
      />
    </div>
  );
}
