"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import EditCaseModal from "@/components/cases/edit-case-modal";
import { useUpdateCaseMutation, type CaseRecord, type UpdateCasePayload } from "@/lib/cases/mutations";
import { useCanEditCase } from "@/lib/cases/permissions";

// Past this many characters the note is clamped behind a Show more toggle.
const CLAMP_AT = 280;

/** The case Overview's Notes card: the free-text notes entered at intake / in Edit case.
 * `header` is the "Edit" action (editors only); `body` is the note, its empty state, and the modal. */
export function useOverviewNotes(caseRecord: CaseRecord | undefined) {
  const { t } = useTranslation("case-portfolio");
  const update = useUpdateCaseMutation();
  const canEdit = useCanEditCase(caseRecord?.id);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const notes = caseRecord?.notes?.trim() ?? "";
  const long = notes.length > CLAMP_AT;

  const save = async (payload: UpdateCasePayload) => {
    if (!caseRecord) return;
    await update.mutateAsync({ id: caseRecord.id, payload });
    setEditing(false);
  };

  const header =
    canEdit && caseRecord ? (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-md text-[12px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <Pencil className="h-3 w-3" aria-hidden="true" />
        {t("overview.notesEdit")}
      </button>
    ) : null;

  const body = (
    <>
      {notes ? (
        <>
          <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-foreground">
            {long && !expanded ? `${notes.slice(0, CLAMP_AT).trimEnd()}…` : notes}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-2 text-[12px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:underline"
            >
              {expanded ? t("overview.notesShowLess") : t("overview.notesShowMore")}
            </button>
          )}
        </>
      ) : (
        <span className="text-[13px] text-muted-foreground leading-relaxed">{t("overview.notesEmpty")}</span>
      )}
      {editing && caseRecord && (
        <EditCaseModal
          key={caseRecord.id}
          caseRecord={caseRecord}
          isSubmitting={update.isPending}
          onSubmit={save}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );

  return { header, body };
}
