"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ChevronDown, Plus } from "lucide-react";
import { useConsultationsQuery } from "@/lib/chat/mutations";

interface ThreadPickerProps {
  caseId: string;
  activeConsultationId: string | null;
  /** Same basePath ConsultationChat below is given — navigating here just changes `?c=`,
   * which ConsultationChat reads as its source of truth (see consultation-chat.tsx). */
  basePath: string;
}

/** Compact stand-in for ConsultationSidebar's full rail (deliberately not shown in Case
 * Workspace — see docs/adr/0012) — same consultations list and same URL-driven switching,
 * just collapsed into a single header dropdown above the embedded chat panel. */
export function ThreadPicker({ caseId, activeConsultationId, basePath }: ThreadPickerProps) {
  const { t } = useTranslation("homepage");
  const router = useRouter();
  const { data: consultations } = useConsultationsQuery(caseId);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const activeLabel =
    consultations?.find((c) => c.id === activeConsultationId)?.title?.trim() ||
    (activeConsultationId ? t("sidebar.untitledConsultation") : t("sidebar.newChat"));

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex max-w-72 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-left text-[13px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <span className="truncate">{activeLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-1.5 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push(basePath);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-foreground hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t("sidebar.newChat")}
          </button>

          <div className="mt-1 max-h-72 overflow-y-auto border-t border-border pt-1">
            {consultations?.length ? (
              consultations.map((c) => {
                const isActive = c.id === activeConsultationId;
                const label = c.title?.trim() || t("sidebar.untitledConsultation");
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push(`${basePath}?c=${c.id}`);
                    }}
                    className={`block w-full truncate rounded-lg px-2.5 py-2 text-left text-[13px] font-medium ${
                      isActive ? "bg-muted text-primary" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {label}
                  </button>
                );
              })
            ) : (
              <p className="px-2.5 py-2 text-[13px] text-muted-foreground">{t("sidebar.recentConsultationsTitle")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
