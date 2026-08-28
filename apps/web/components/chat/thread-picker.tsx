"use client";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useConsultationsQuery, useRenameConsultationMutation } from "@/lib/chat/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface ThreadPickerProps {
  caseId: string;
  activeConsultationId: string | null;
}

/** Case-scoped header label — a Case's chat is a single thread, not a list to browse or fork
 * from, so this only ever shows the consultation currently open for this case: no "+ New chat"
 * affordance, no dropdown of the case's other consultations. Click-to-edit renames it in place,
 * reusing the same rename mutation the full consultation sidebar's inline editor uses
 * (consultation-sidebar.tsx). Disabled until a consultation actually exists — there's nothing
 * to rename yet for the "New chat" placeholder state. */
export function ThreadPicker({ caseId, activeConsultationId }: ThreadPickerProps) {
  const { t } = useTranslation("homepage");
  const { data: consultations } = useConsultationsQuery(caseId);
  const renameConsultation = useRenameConsultationMutation();

  const activeLabel =
    consultations?.find((c) => c.id === activeConsultationId)?.title?.trim() ||
    (activeConsultationId ? t("sidebar.untitledConsultation") : t("sidebar.newChat"));

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(activeLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  // Seeds the draft from the current saved title right as editing starts, rather than
  // syncing continuously — editValue is only ever read while isEditing is true, so there's
  // nothing to keep fresh in between edits.
  const startEditing = () => {
    setEditValue(activeLabel);
    setIsEditing(true);
  };

  // Same box model (border width + padding) in every state below — static text, hover
  // target, and the edit input — so entering/leaving edit mode never shifts the header row.
  const boxClassName = "min-w-0 max-w-full truncate rounded-lg border px-2 py-1 -mx-2 text-[15px] font-semibold text-foreground";

  if (!activeConsultationId) {
    return <h1 className={`${boxClassName} border-transparent`}>{activeLabel}</h1>;
  }

  const commitEdit = () => {
    const title = editValue.trim();
    setIsEditing(false);
    if (title && title !== activeLabel) {
      renameConsultation.mutate({ consultationId: activeConsultationId, title });
    }
  };

  if (isEditing) {
    return (
      <h1 className={`${boxClassName} flex items-center gap-1 overflow-visible border-primary/50 bg-muted`}>
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit();
            }
            if (e.key === "Escape") setIsEditing(false);
          }}
          onBlur={commitEdit}
          aria-label={t("sidebar.renameConsultationNamed", { name: activeLabel })}
          className="min-w-0 flex-1 truncate bg-transparent font-semibold text-foreground outline-none"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              // onMouseDown (not onClick) fires before the input's onBlur, so this commits
              // the edit itself instead of racing the blur-triggered commit above.
              onMouseDown={(e) => {
                e.preventDefault();
                commitEdit();
              }}
              aria-label={t("sidebar.saveTitle")}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t("sidebar.saveTitle")}</TooltipContent>
        </Tooltip>
      </h1>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <h1
          role="button"
          tabIndex={0}
          onClick={startEditing}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              startEditing();
            }
          }}
          aria-label={t("sidebar.renameConsultationNamed", { name: activeLabel })}
          className={`${boxClassName} cursor-text border-transparent transition-colors hover:border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30`}
        >
          {activeLabel}
        </h1>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t("sidebar.renameConsultation")}</TooltipContent>
    </Tooltip>
  );
}
