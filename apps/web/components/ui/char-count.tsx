"use client";

import { useTranslation } from "react-i18next";

interface CharCountProps {
  id?: string;
  length: number;
  max: number;
  className?: string;
}

/**
 * The counter under a length-capped text field (pair it with the input's `maxLength`). Stays out
 * of the way until the value nears the cap, then shows "n / max"; at the cap it says so. Past the
 * cap only happens with a value saved before the cap existed — the API rejects it, so it asks
 * for a shorter one instead of failing on save.
 */
export function CharCount({ id, length, max, className = "" }: CharCountProps) {
  const { t } = useTranslation("create-case");
  if (length < max * 0.8) return null;

  const over = length - max;
  const tone =
    over > 0 ? "text-red-600 dark:text-red-400" : over === 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground";

  return (
    <p id={id} aria-live="polite" className={`flex items-center justify-between gap-3 text-xs ${tone} ${className}`}>
      <span>{over > 0 ? t("fieldLimit.over", { over, max }) : over === 0 ? t("fieldLimit.reached", { max }) : null}</span>
      <span className="shrink-0 tabular-nums">
        {length} / {max}
      </span>
    </p>
  );
}
