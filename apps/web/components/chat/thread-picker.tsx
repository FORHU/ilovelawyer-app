"use client";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCanContributeToCase } from "@/lib/cases/permissions";
import { useConsultationsQuery, useRenameConsultationMutation } from "@/lib/chat/mutations";
import { useConsultationDraft, useConsultationDraftsStore } from "@/lib/store/consultation-drafts.store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface ThreadPickerProps {
  caseId: string;
  activeConsultationId: string | null;
  /** The Case's unsaved draft is open (see consultation-drafts.store.ts) — `?c=new` in Case
   * Workspace, or the same marker in the local state of Terminal's chat pane. */
  isDraftActive?: boolean;
}

/** Case-scoped chat header: the open Consultation's title, click-to-edit (rename reuses the same
 * mutation as the full consultation sidebar, consultation-sidebar.tsx; on the draft it renames the
 * draft, sent as the title when its first message creates it). Choosing between a Case's
 * Consultations happens in the Case Workspace's left panel (consultation-tree.tsx), where each
 * one lists its own Topics. */
export function ThreadPicker({ caseId, activeConsultationId, isDraftActive = false }: ThreadPickerProps) {
  const { t } = useTranslation("homepage");
  const { data: consultations } = useConsultationsQuery(caseId);
  const renameConsultation = useRenameConsultationMutation();
  const { draft } = useConsultationDraft(isDraftActive ? caseId : undefined);
  const ensureDraft = useConsultationDraftsStore((s) => s.ensureDraft);
  const updateDraft = useConsultationDraftsStore((s) => s.updateDraft);

  const draftLabel = draft?.title.trim() || t("sidebar.newConsultation");
  const activeLabel = isDraftActive
    ? draftLabel
    : consultations?.find((c) => c.id === activeConsultationId)?.title?.trim() ||
      (activeConsultationId ? t("sidebar.untitledConsultation") : t("sidebar.newChat"));
  // Not for a view-only person on a confidential case, who can read its consultations only.
  const readOnly = !useCanContributeToCase(caseId);
  const canRename = (Boolean(activeConsultationId) || isDraftActive) && !readOnly;

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(activeLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  // A rename half-typed in one consultation must not be committed onto the next one.
  const openKey = isDraftActive ? "draft" : activeConsultationId;
  const [editingFor, setEditingFor] = useState(openKey);
  if (editingFor !== openKey) {
    setEditingFor(openKey);
    setIsEditing(false);
  }

  // Seeds the draft from the current saved title right as editing starts, rather than
  // syncing continuously — editValue is only ever read while isEditing is true, so there's
  // nothing to keep fresh in between edits. The draft starts empty (its label is a placeholder).
  const startEditing = () => {
    setEditValue(isDraftActive ? (draft?.title ?? "") : activeLabel);
    setIsEditing(true);
  };

  const commitEdit = () => {
    const title = editValue.trim();
    setIsEditing(false);
    if (isDraftActive) {
      ensureDraft(caseId);
      updateDraft(caseId, { title });
      return;
    }
    if (activeConsultationId && title && title !== activeLabel) {
      renameConsultation.mutate({ consultationId: activeConsultationId, title });
    }
  };

  // Same box model (border width + padding) in every state below — static text, hover
  // target, and the edit input — so entering/leaving edit mode never shifts the header row.
  const boxClassName = "min-w-0 max-w-full truncate rounded-lg border px-2 py-1 -mx-2 text-[15px] font-semibold text-foreground";

  let title;
  if (!canRename) {
    title = <h1 className={`${boxClassName} border-transparent`}>{activeLabel}</h1>;
  } else if (isEditing) {
    title = (
      <h1 className={`${boxClassName} flex items-center gap-1 overflow-visible border-primary/50 bg-muted`}>
        <input
          ref={inputRef}
          value={editValue}
          placeholder={isDraftActive ? t("sidebar.newConsultation") : undefined}
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
          className="min-w-0 flex-1 truncate bg-transparent font-semibold text-foreground outline-none placeholder:text-muted-foreground"
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
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-card dark:hover:bg-overlay-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t("sidebar.saveTitle")}</TooltipContent>
        </Tooltip>
      </h1>
    );
  } else {
    title = (
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
            className={`${boxClassName} cursor-text border-transparent transition-colors hover:border-border hover:bg-muted dark:hover:bg-overlay-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30`}
          >
            {activeLabel}
          </h1>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("sidebar.renameConsultation")}</TooltipContent>
      </Tooltip>
    );
  }

  return title;
}
