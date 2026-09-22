"use client";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  /** Descriptive tooltip shown on hover over the trigger — this is a generic
   * dropdown, so callers supply copy specific to what the field controls. */
  triggerTooltip?: string;
}

interface MenuPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
}

// Native <select> popups can't be restyled (rounded corners, font size, hover
// states) in Chromium on Windows regardless of what CSS is applied to the
// control itself, so this reimplements it as a plain button + listbox to get
// full control over how the open menu looks.
export default function CustomSelect({ id, value, onChange, options, placeholder, className = "", triggerTooltip }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const handleTriggerClick = () => {
    if (open) {
      setOpen(false);
      return;
    }
    // Positioned fixed to the trigger's on-screen coords (not `absolute` inside the
    // trigger's own wrapper) so a scrollable ancestor — like the Party Details list —
    // can't clip the open menu the way it would clip a normally-flowed descendant.
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      // Options render taller below the `sm` breakpoint (`py-3` vs `py-2` — see the option
      // button's className below), so a row-height estimate tuned for desktop undercounts on
      // mobile and lets a short list (e.g. this component's own 6-item reminder-lead select)
      // get needlessly clipped into scrolling by the mismatched max-height class beneath it.
      const isMobileWidth = window.innerWidth < 640;
      const rowHeight = isMobileWidth ? 44 : 36;
      const menuMaxHeight = isMobileWidth ? 296 : 232; // matches max-h-72/max-h-56 + py-1 below
      const estimatedMenuHeight = Math.min(options.length * rowHeight + 8, menuMaxHeight);
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < estimatedMenuHeight && rect.top > spaceBelow;
      setMenuPosition(
        openUpward
          ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 6 }
          : { left: rect.left, width: rect.width, top: rect.bottom + 6 },
      );
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    // The menu itself is portalled to <body> (see the render below) so a transformed
    // ancestor — e.g. a Dialog centered via `transform` — can't hijack its `position: fixed`
    // coords. That also means it's no longer a DOM descendant of rootRef, so containment
    // checks below have to test both refs, not just rootRef.
    const isInsideSelect = (node: Node) => !!(rootRef.current?.contains(node) || menuRef.current?.contains(node));
    const handlePointerDown = (e: MouseEvent) => {
      if (!isInsideSelect(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Any ancestor (e.g. the scrollable Party Details list) scrolling means our computed
    // fixed position is now stale — close rather than let the menu drift from its trigger.
    // Scrolling *within* the menu's own option list is excluded via the containment check.
    const handleScroll = (e: Event) => {
      // Shared with the window "resize" listener below, whose event target is `window`
      // itself — not a Node — so the containment check only applies when it actually is one.
      if (e.target instanceof Node && isInsideSelect(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      id={id}
      onClick={handleTriggerClick}
      className="w-full min-w-0 flex items-center justify-between gap-2 border border-border rounded-xl py-3 sm:py-2 px-3 text-base sm:text-sm text-left bg-transparent cursor-pointer hover:border-foreground/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
      aria-haspopup="listbox"
      aria-expanded={open}
    >
      <span className={`min-w-0 truncate ${selected ? "text-foreground" : "text-muted-foreground"}`}>
        {selected ? selected.label : placeholder}
      </span>
      <ChevronDown
        className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        aria-hidden="true"
      />
    </button>
  );

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {triggerTooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>{triggerTooltip}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}

      {open && menuPosition &&
        // Portalled to <body> — a plain in-place `position: fixed` descendant would instead
        // resolve relative to any transformed ancestor (e.g. a centering-via-transform Dialog),
        // landing the menu wherever that ancestor's box is instead of under the trigger.
        createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            // Radix Dialog sets `document.body { pointer-events: none }` while a modal is open,
            // re-enabling it only on the dialog's own content element. This menu is portaled
            // straight to <body> as a sibling of that content (not a descendant), so without an
            // explicit override here it silently inherits `none` — the menu still renders on
            // top, but every option click gets swallowed, whenever this select is opened from
            // inside a Dialog.
            style={{ ...(menuPosition as CSSProperties), pointerEvents: "auto" }}
            // Same Dialog-scroll-lock story as the pointer-events override above, but for the
            // mouse wheel: Radix's scroll lock (react-remove-scroll) globally intercepts wheel/
            // touch scrolling while a modal is open and only lets it through inside the dialog's
            // own recognized content — this menu, being a sibling portal, isn't part of that, so
            // the lock swallows the scroll before it ever reaches the `<ul>`'s native overflow
            // handling. Scrolling it ourselves here bypasses that global listener entirely.
            onWheel={(e) => {
              e.stopPropagation();
              const el = menuRef.current;
              if (!el) return;
              const max = el.scrollHeight - el.clientHeight;
              el.scrollTop = Math.min(Math.max(el.scrollTop + e.deltaY, 0), max);
            }}
            className="fixed z-(--z-modal) max-h-72 sm:max-h-56 overflow-y-auto rounded-xl border border-border bg-card shadow-lg py-1 text-sm"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <li key={opt.value} role="option" aria-selected={isSelected}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(opt.value);
                          setOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-3 sm:py-2 text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:bg-muted ${
                          isSelected ? "bg-muted text-foreground font-medium" : "text-foreground hover:bg-muted/50 dark:hover:bg-overlay-hover"
                        }`}
                      >
                        {opt.label}
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Select {opt.label}</TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </div>
  );
}
