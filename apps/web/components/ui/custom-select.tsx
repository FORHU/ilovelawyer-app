"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

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
export default function CustomSelect({ id, value, onChange, options, placeholder, className = "" }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
      const estimatedMenuHeight = Math.min(options.length * 36 + 8, 232); // matches max-h-56 + py-1
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
    const handlePointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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
      if (e.target instanceof Node && rootRef.current?.contains(e.target)) return;
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

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={handleTriggerClick}
        className="w-full flex items-center justify-between gap-2 border border-gray-300 rounded-xl py-2 px-3 text-sm text-left bg-transparent cursor-pointer hover:border-gray-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/30 focus-visible:border-[#131a33]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "text-[#181c1e]" : "text-gray-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && menuPosition && (
        <ul
          role="listbox"
          style={menuPosition}
          className="fixed z-50 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1 text-sm"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li key={opt.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:bg-slate-100 ${
                    isSelected ? "bg-slate-100 text-black font-medium" : "text-[#181c1e] hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
