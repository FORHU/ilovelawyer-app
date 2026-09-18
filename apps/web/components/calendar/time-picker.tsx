"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0-59
const PERIODS = ["AM", "PM"] as const;

type Period = (typeof PERIODS)[number];
type Parsed = { hour: number; minute: number; period: Period };

function parseValue(value: string): Parsed | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (hour24 > 23 || minute > 59) return null;
  const period: Period = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour, minute, period };
}

function buildValue(hour: number, minute: number, period: Period): string {
  const hour24 = period === "AM" ? hour % 12 : (hour % 12) + 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDisplay(parsed: Parsed | null): string | null {
  if (!parsed) return null;
  return `${parsed.hour}:${String(parsed.minute).padStart(2, "0")} ${parsed.period}`;
}

type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
};

export function TimePicker({ value, onChange, placeholder = "Select time", "aria-label": ariaLabel, className }: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = parseValue(value);
  const display = formatDisplay(parsed);

  const hourListRef = React.useRef<HTMLDivElement>(null);
  const minuteListRef = React.useRef<HTMLDivElement>(null);
  const periodListRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    // Deferred a frame so the popover has finished mounting before we measure scroll offsets.
    const raf = requestAnimationFrame(() => {
      for (const ref of [hourListRef, minuteListRef, periodListRef]) {
        ref.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: "center" });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  function commit(hour: number, minute: number, period: Period) {
    onChange(buildValue(hour, minute, period));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-primary data-[state=open]:border-primary",
            display ? "text-foreground" : "text-muted-foreground",
            className
          )}
        >
          {display ?? placeholder}
          <Clock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-auto gap-1 p-1.5">
        <TimeColumn
          containerRef={hourListRef}
          values={HOURS}
          selected={parsed?.hour ?? null}
          format={(h) => String(h)}
          onSelect={(h) => commit(h, parsed?.minute ?? 0, parsed?.period ?? "AM")}
        />
        <TimeColumn
          containerRef={minuteListRef}
          values={MINUTES}
          selected={parsed?.minute ?? null}
          format={(m) => String(m).padStart(2, "0")}
          onSelect={(m) => commit(parsed?.hour ?? 12, m, parsed?.period ?? "AM")}
        />
        <TimeColumn
          containerRef={periodListRef}
          values={PERIODS}
          selected={parsed?.period ?? null}
          format={(p) => p}
          onSelect={(p) => commit(parsed?.hour ?? 12, parsed?.minute ?? 0, p)}
        />
      </PopoverContent>
    </Popover>
  );
}

function TimeColumn<T extends string | number>({
  containerRef,
  values,
  selected,
  format,
  onSelect,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  values: readonly T[];
  selected: T | null;
  format: (value: T) => string;
  onSelect: (value: T) => void;
}) {
  return (
    <div ref={containerRef} className="max-h-48 w-14 overflow-y-auto">
      <div className="flex flex-col gap-0.5">
        {values.map((v) => {
          const isSelected = selected === v;
          return (
            <button
              key={v}
              type="button"
              data-selected={isSelected}
              onClick={() => onSelect(v)}
              className={cn(
                "rounded-lg px-2 py-1.5 text-center text-[13px] tabular-nums outline-none transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted dark:hover:bg-overlay-hover"
              )}
            >
              {format(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
