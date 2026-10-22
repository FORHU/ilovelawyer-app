"use client";

import { useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { addTags } from "@/lib/tag-list";

interface TagInputProps {
  label: React.ReactNode;
  helperText?: React.ReactNode;
  value: string[];
  onChange: (next: string[]) => void;
  /** Most tags allowed; the input hides once it's reached. */
  max: number;
  maxTagLength: number;
  placeholder?: string;
  /** Accessible name and tooltip for a tag's remove button, e.g. `Remove ${tag}`. */
  removeLabel: (tag: string) => string;
}

/**
 * A list of short free-text values as removable chips, laid out like TextField (label above,
 * helper below it). Enter or a comma adds what's typed, as does leaving the field; Backspace in
 * an empty field removes the last chip; a pasted comma-separated list becomes several.
 */
export function TagInput({ label, helperText, value, onChange, max, maxTagLength, placeholder, removeLabel }: TagInputProps) {
  const inputId = useId();
  const helperId = `${inputId}-helper`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const full = value.length >= max;

  const commit = (raw: string) => {
    const next = addTags(value, raw, { max, maxLength: maxTagLength });
    if (next !== value) onChange(next);
    setDraft("");
  };

  const remove = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
        {label}
      </label>
      {helperText && (
        <p id={helperId} className="text-xs text-muted-foreground">
          {helperText}
        </p>
      )}
      {/* Clicking the box's empty space focuses the input, as in a single text field. */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex min-h-[46px] w-full cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-border bg-transparent px-2 py-1.5 transition-colors",
          "hover:border-foreground/30 focus-within:border-foreground focus-within:ring-2 focus-within:ring-foreground/5",
        )}
      >
        {value.map((tag) => (
          <span key={tag} className="inline-flex h-7 items-center gap-1 rounded-full bg-muted pl-3 pr-1 text-[13px] text-foreground">
            {tag}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(tag);
                  }}
                  aria-label={removeLabel(tag)}
                  className="cursor-pointer rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{removeLabel(tag)}</TooltipContent>
            </Tooltip>
          </span>
        ))}
        {!full && (
          <input
            ref={inputRef}
            id={inputId}
            value={draft}
            maxLength={maxTagLength}
            placeholder={value.length === 0 ? placeholder : undefined}
            aria-describedby={helperText ? helperId : undefined}
            onChange={(e) => {
              // A comma typed (or pasted mid-word) ends the tag.
              if (e.target.value.includes(",")) commit(e.target.value);
              else setDraft(e.target.value);
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (!pasted.includes(",")) return;
              e.preventDefault();
              commit(draft + pasted);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Never submits the surrounding form; adds the tag instead.
                e.preventDefault();
                commit(draft);
              } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
                onChange(value.slice(0, -1));
              }
            }}
            onBlur={() => commit(draft)}
            className="h-8 min-w-[10ch] flex-1 bg-transparent px-1 text-base outline-none sm:text-sm"
          />
        )}
      </div>
    </div>
  );
}
