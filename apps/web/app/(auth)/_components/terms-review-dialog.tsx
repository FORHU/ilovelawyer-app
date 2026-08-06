"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Ban, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface Section {
  number: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  prohibited?: string[];
  quote?: string;
}

// A couple of pixels of slack — some browsers report fractional scroll heights
// that never quite reach 0 even when the content is fully visible.
const SCROLL_END_THRESHOLD_PX = 4;

export function TermsReviewDialog({
  open,
  onOpenChange,
  onAgree,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgree: () => void;
}) {
  const { t } = useTranslation("term");
  const { t: tAuth } = useTranslation("auth");
  const SECTIONS = t("sections", { returnObjects: true }) as Section[];

  const scrollRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);

  // Re-require a full read each time the dialog opens, and check once up
  // front in case the content is short enough to need no scrolling at all.
  useEffect(() => {
    if (!open) return;
    setReachedEnd(false);
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.clientHeight <= SCROLL_END_THRESHOLD_PX) {
      setReachedEnd(true);
    }
  }, [open]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_END_THRESHOLD_PX) {
      setReachedEnd(true);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle className="font-['Libre_Caslon_Text'] text-2xl font-normal">{t("title")}</DialogTitle>
          <DialogDescription>{t("effectiveDate")}</DialogDescription>
        </DialogHeader>

        <div ref={scrollRef} onScroll={handleScroll} className="flex flex-col overflow-y-auto px-6 py-4">
          {SECTIONS.map((section) => (
            <section key={section.number} className="flex flex-col gap-2 border-b border-border py-5 last:border-b-0">
              <p className="text-[11px] font-medium uppercase tracking-[1.5px] text-muted-foreground">
                {section.number} — {section.title}
              </p>

              <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
                {section.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              {section.bullets && (
                <ul className="flex flex-col gap-1.5">
                  {section.bullets.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {section.prohibited && (
                <ul className="flex flex-col gap-1.5">
                  {section.prohibited.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
                      <Ban className="mt-0.5 size-3.5 shrink-0 text-red-500 dark:text-red-400" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {section.quote && (
                <blockquote className="border-l-2 border-primary bg-foreground/[0.03] py-2 pl-4 text-sm italic leading-relaxed text-muted-foreground">
                  {section.quote}
                </blockquote>
              )}
            </section>
          ))}
        </div>

        <DialogFooter className="items-center border-t border-border px-6 py-4">
          {reachedEnd ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    onAgree();
                    onOpenChange(false);
                  }}
                  className="cursor-pointer rounded-md bg-brand-navy-950 px-5 py-2.5 text-xs font-medium uppercase tracking-[1px] text-white transition-colors hover:bg-brand-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-950/40 focus-visible:ring-offset-2"
                >
                  {tAuth("signup.readAndAgree")}
                </button>
              </TooltipTrigger>
              <TooltipContent>Confirm you've read and agree to this document</TooltipContent>
            </Tooltip>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ChevronDown className="size-3.5 animate-bounce" aria-hidden="true" />
              {tAuth("signup.scrollToContinue")}
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
