"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CharCount } from "@/components/ui/char-count";
import { CASE_NOTES_MAX_LENGTH } from "@/lib/cases/limits";
import { useUpdateCaseMutation, type CaseRecord } from "@/lib/cases/mutations";
import { useCanEditCase } from "@/lib/cases/permissions";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";

const actionClass =
  "inline-flex items-center gap-1 rounded-md text-[12px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

/** The case Overview's Notes card: the free-text notes entered at intake.
 * `header` holds Add / Edit / Delete (editors only); `body` is the scrollable note, its empty state,
 * and a notes-only dialog — saving sends `{ notes }` and nothing else. */
export function useOverviewNotes(caseRecord: CaseRecord | undefined) {
  const { t } = useTranslation("case-portfolio");
  const update = useUpdateCaseMutation();
  const canEdit = useCanEditCase(caseRecord?.id);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState("");

  const notes = caseRecord?.notes?.trim() ?? "";

  const save = async (value: string) => {
    if (!caseRecord) return;
    await update.mutateAsync({ id: caseRecord.id, payload: { notes: value.trim() } });
    setEditing(false);
    setDeleting(false);
  };

  const remove = async () => {
    try {
      await save("");
      toast.success(t("overview.notesDeleted"));
    } catch {
      toast.error(t("overview.notesDeleteError"));
    }
  };

  const header =
    canEdit && caseRecord ? (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setDraft(notes);
            setEditing(true);
          }}
          className={actionClass}
        >
          {notes ? <Pencil className="h-3 w-3" aria-hidden="true" /> : <Plus className="h-3 w-3" aria-hidden="true" />}
          {notes ? t("overview.notesEdit") : t("overview.notesAdd")}
        </button>
        {notes && (
          <button type="button" onClick={() => setDeleting(true)} className={`${actionClass} hover:text-red-600`}>
            <Trash2 className="h-3 w-3" aria-hidden="true" />
            {t("overview.notesDelete")}
          </button>
        )}
      </div>
    ) : null;

  const body = (
    <>
      {notes ? (
        <p className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-[14px] leading-relaxed text-foreground">
          {notes}
        </p>
      ) : (
        <span className="text-[13px] text-muted-foreground leading-relaxed">{t("overview.notesEmpty")}</span>
      )}
      <Dialog open={deleting} onOpenChange={(open) => !open && !update.isPending && setDeleting(false)}>
        <DialogContent className="max-w-sm gap-4 p-6">
          <DialogTitle className="font-['Libre_Caslon_Text'] text-lg font-normal">{t("overview.notesDeleteTitle")}</DialogTitle>
          <DialogDescription>{t("overview.notesDeleteConfirm")}</DialogDescription>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleting(false)}
              disabled={update.isPending}
              className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full transition-colors cursor-pointer disabled:opacity-40"
            >
              {t("overview.notesCancel")}
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={update.isPending}
              className="bg-red-600 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-red-700 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {update.isPending ? t("overview.notesDeleting") : t("overview.notesDelete")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={editing} onOpenChange={(open) => !open && setEditing(false)}>
        <DialogContent className="max-w-lg gap-4 p-6">
          <DialogTitle className="font-['Libre_Caslon_Text'] text-lg font-normal">
            {notes ? t("overview.notesEditTitle") : t("overview.notesAddTitle")}
          </DialogTitle>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(draft);
            }}
            className="flex flex-col gap-2"
          >
            <textarea
              autoFocus
              rows={8}
              aria-label={t("overview.notes")}
              className="w-full rounded-xl border border-border bg-transparent px-3 py-2.5 outline-none text-base sm:text-sm transition-colors resize-none hover:border-foreground/30 focus:border-foreground focus:ring-2 focus:ring-foreground/5"
              maxLength={CASE_NOTES_MAX_LENGTH}
              aria-describedby="overview-notes-count"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <CharCount id="overview-notes-count" length={draft.length} max={CASE_NOTES_MAX_LENGTH} />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full transition-colors cursor-pointer"
              >
                {t("overview.notesCancel")}
              </button>
              <button
                type="submit"
                disabled={update.isPending || !draft.trim() || draft.trim() === notes}
                className="bg-brand-navy-900 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-brand-navy-800 transition-colors uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {update.isPending ? t("overview.notesSaving") : t("overview.notesSave")}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );

  return { header, body };
}
