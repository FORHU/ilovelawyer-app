"use client";

import * as React from "react";
import { Clock, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import {
  TYPED_TIME_MAX_LENGTH,
  buildSlots,
  formatMinutes,
  maskTypedTime,
  nextQuarterHour,
  parseTypedTime,
  splitDuration,
  toMinutes,
  toValue,
  typedTimeProblem,
} from "./time-picker-utils";

type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  /** "HH:mm" — options at or before this are disabled (e.g. End must follow Start). */
  minTime?: string;
  /** Show each option's length relative to `minTime` ("30m", "1h 30m"). */
  showDuration?: boolean;
  /** Read-only date shown beside the typed time in the footer. */
  dateLabel?: string;
  align?: "start" | "end";
};

export function TimePicker({
  value,
  onChange,
  placeholder = "Select time",
  "aria-label": ariaLabel,
  className,
  minTime,
  showDuration = false,
  dateLabel,
  align = "start",
}: TimePickerProps) {
  const { t } = useTranslation("calendar");
  const [open, setOpen] = React.useState(false);
  // What's highlighted in the list / typed in the footer; only written back on Set.
  const [pending, setPending] = React.useState<number | null>(null);
  const [typed, setTyped] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const listRef = React.useRef<HTMLDivElement>(null);
  const optionRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // The popover portals to <body>, outside the appointment Dialog's content, so Radix's
  // modal scroll lock (react-remove-scroll) swallows wheel/touch scrolling before it reaches
  // this list. Scroll it ourselves via non-passive listeners — React's onWheel/onTouchMove
  // are passive and can't preventDefault, which would double-scroll outside a Dialog.
  const attachList = React.useCallback((el: HTMLDivElement | null) => {
    listRef.current = el;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // deltaMode 1 = lines (Firefox with some mice); approximate a line as one option row.
      el.scrollTop += e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    };
    let lastY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      lastY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (y === undefined || lastY === null) return;
      e.preventDefault();
      el.scrollTop += lastY - y;
      lastY = y;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      listRef.current = null;
    };
  }, []);

  const current = toMinutes(value);
  const min = minTime ? toMinutes(minTime) : null;
  const slots = React.useMemo(() => buildSlots(current), [current]);
  const isDisabled = (minutes: number) => min !== null && minutes <= min;
  const fieldLabel = ariaLabel ?? placeholder;
  const typedId = React.useId();
  const dateId = React.useId();

  function formatDuration(minutes: number): string {
    const { hours, minutes: rest } = splitDuration(minutes);
    if (!hours) return t("timePicker.durationMinutes", { minutes: rest });
    if (!rest) return t("timePicker.durationHours", { hours });
    return t("timePicker.durationHoursMinutes", { hours, minutes: rest });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setPending(current);
    setTyped(current !== null ? formatMinutes(current) : "");
    setError(null);
    const anchor = current ?? (min !== null ? min + 60 : nextQuarterHour(new Date()));
    let index = slots.findIndex((s) => s >= anchor && !isDisabled(s));
    if (index < 0) index = slots.findIndex((s) => !isDisabled(s));
    setActiveIndex(index);
  }

  React.useEffect(() => {
    if (!open) return;
    // Deferred a frame so the popover has finished mounting before we measure scroll offsets.
    const raf = requestAnimationFrame(() => {
      const list = listRef.current;
      const option = optionRefs.current[activeIndex];
      if (list && option) list.scrollTop = option.offsetTop - list.clientHeight / 2 + option.offsetHeight / 2;
      list?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
    // Only on open — later activeIndex changes scroll with `nearest` in moveActive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function commit(minutes: number) {
    onChange(toValue(minutes));
    setOpen(false);
  }

  function selectOption(index: number) {
    const minutes = slots[index]!;
    setActiveIndex(index);
    setPending(minutes);
    setTyped(formatMinutes(minutes));
    setError(null);
  }

  function moveActive(direction: 1 | -1) {
    let index = activeIndex;
    do index += direction;
    while (index >= 0 && index < slots.length && isDisabled(slots[index]!));
    if (index < 0 || index >= slots.length) return;
    selectOption(index);
    optionRefs.current[index]?.scrollIntoView({ block: "nearest" });
  }

  function problemMessage(text: string): string | null {
    const problem = typedTimeProblem(text);
    if (problem === "minutes") return t("timePicker.errors.minutes");
    if (problem === "hours12") return t("timePicker.errors.hours12");
    if (problem === "hours24") return t("timePicker.errors.hours24");
    return null;
  }

  function handleTypedChange(raw: string) {
    const masked = maskTypedTime(raw).slice(0, TYPED_TIME_MAX_LENGTH);
    setTyped(masked);
    const problem = problemMessage(masked);
    setError(problem);
    const minutes = problem ? null : parseTypedTime(masked);
    if (minutes === null) return;
    setPending(minutes);
    const index = slots.indexOf(minutes);
    if (index >= 0) {
      setActiveIndex(index);
      optionRefs.current[index]?.scrollIntoView({ block: "nearest" });
    }
  }

  function handleSet() {
    if (typed.trim()) {
      const minutes = parseTypedTime(typed);
      if (minutes === null) return setError(problemMessage(typed) ?? t("timePicker.errors.invalid"));
      if (min !== null && minutes <= min) return setError(t("timePicker.errors.after", { time: formatMinutes(min) }));
      return commit(minutes);
    }
    if (pending !== null) return commit(pending);
    setError(t("timePicker.errors.required"));
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm tabular-nums outline-none transition-colors focus:border-primary data-[state=open]:border-primary",
            current !== null ? "text-foreground" : "text-muted-foreground",
            className
          )}
        >
          {current !== null ? formatMinutes(current) : placeholder}
          <Clock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="flex w-60 flex-col overflow-hidden bg-popover p-0"
        aria-label={fieldLabel}
        // Focus goes to the list (in the effect above) rather than the first button.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="grid grid-cols-[1.75rem_1fr_1.75rem] items-center border-b border-border px-2 py-1.5">
          <span />
          <p className="text-center text-sm font-semibold">{fieldLabel}</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("timePicker.close")}
            className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-overlay-hover"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div
          ref={attachList}
          role="listbox"
          aria-label={fieldLabel}
          aria-activedescendant={activeIndex >= 0 ? `${typedId}-opt-${activeIndex}` : undefined}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              moveActive(e.key === "ArrowDown" ? 1 : -1);
            } else if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              commit(slots[activeIndex]!);
            }
          }}
          className="flex max-h-60 flex-col gap-0.5 overflow-y-auto px-2 py-1.5 outline-none"
        >
          {slots.map((minutes, index) => {
            const disabled = isDisabled(minutes);
            const selected = minutes === pending;
            return (
              <button
                key={minutes}
                id={`${typedId}-opt-${index}`}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                disabled={disabled}
                onClick={() => selectOption(index)}
                onDoubleClick={() => commit(minutes)}
                className={cn(
                  "relative flex min-h-8 shrink-0 items-center justify-center rounded-md text-sm tabular-nums outline-none transition-colors",
                  selected
                    ? "bg-primary font-medium text-primary-foreground"
                    : disabled
                      ? "cursor-not-allowed text-muted-foreground/50"
                      : cn(
                          "text-foreground hover:bg-accent dark:hover:bg-overlay-hover",
                          index === activeIndex && "bg-accent dark:bg-overlay-hover"
                        )
                )}
              >
                {formatMinutes(minutes)}
                {showDuration && min !== null && minutes > min && (
                  <span
                    className={cn(
                      "absolute right-2.5 text-[11px]",
                      selected ? "text-primary-foreground/75" : "text-muted-foreground"
                    )}
                  >
                    {formatDuration(minutes - min)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5 border-t border-border p-2.5">
          <div className={cn("grid gap-2", dateLabel && "grid-cols-2")}>
            {dateLabel && (
              <label htmlFor={dateId} className="flex flex-col gap-1 text-xs font-medium">
                {t("timePicker.date")}
                <input
                  id={dateId}
                  value={dateLabel}
                  readOnly
                  tabIndex={-1}
                  className="w-full min-w-0 rounded-md border border-transparent bg-muted px-2 py-1.5 text-[13px] text-muted-foreground tabular-nums outline-none dark:bg-overlay-hover"
                />
              </label>
            )}
            <label htmlFor={typedId} className="flex flex-col gap-1 text-xs font-medium">
              {t("timePicker.time")}
              <input
                id={typedId}
                value={typed}
                maxLength={TYPED_TIME_MAX_LENGTH}
                placeholder={t("timePicker.typePlaceholder")}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={error ? true : undefined}
                onChange={(e) => handleTypedChange(e.target.value)}
                onKeyDown={(e) => {
                  const input = e.currentTarget;
                  const caretAtEnd = input.selectionStart === typed.length && input.selectionEnd === typed.length;
                  if (e.key === "Backspace" && caretAtEnd && / [AP]M$/.test(typed)) {
                    // Remove AM/PM in one keypress — otherwise the mask would re-add it.
                    e.preventDefault();
                    handleTypedChange(typed.slice(0, -3));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    handleSet();
                  }
                }}
                onBlur={() => {
                  const minutes = parseTypedTime(typed);
                  if (minutes !== null && !typedTimeProblem(typed)) setTyped(formatMinutes(minutes));
                }}
                className="w-full min-w-0 rounded-md border border-transparent bg-muted px-2 py-1.5 text-[13px] text-foreground tabular-nums outline-none placeholder:text-muted-foreground focus:border-ring focus:bg-transparent aria-invalid:border-destructive dark:bg-overlay-hover"
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="-mt-1 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-border px-3 py-1.5 text-[13px] font-semibold text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-overlay-hover"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleSet}
              className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("timePicker.set")}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
