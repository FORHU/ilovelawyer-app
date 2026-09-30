"use client";
import { useState } from "react";
import { AlertCircle, AlertTriangle, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";
import { useDeleteRiskMutation, useUpdateRiskMutation } from "@/lib/terminal/mutations";
import type { SnapshotRisk } from "@/lib/terminal/types";

/** Case Overview's Key Issues — the case's risk register (the same records as the Terminal's
 * Case Summary risk list), each editable in place and deletable behind a confirmation. */
export function KeyIssuesList({ caseId, risks }: { caseId: string; risks: SnapshotRisk[] }) {
  const [deleting, setDeleting] = useState<SnapshotRisk | null>(null);
  const deleteRisk = useDeleteRiskMutation(caseId);

  return (
    <>
      <div className="flex flex-col gap-1">
        {risks.map((risk) => (
          <KeyIssueRow key={risk.id} caseId={caseId} risk={risk} onDelete={() => setDeleting(risk)} />
        ))}
      </div>
      {deleting && (
        <DeleteKeyIssueModal
          title={deleting.title}
          isDeleting={deleteRisk.isPending}
          failed={deleteRisk.isError}
          onConfirm={() => deleteRisk.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
          onClose={() => {
            deleteRisk.reset();
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}

function KeyIssueRow({ caseId, risk, onDelete }: { caseId: string; risk: SnapshotRisk; onDelete: () => void }) {
  const { t } = useTranslation("case-portfolio");
  const updateRisk = useUpdateRiskMutation(caseId);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEditing = () => {
    setDraft(risk.title);
    setIsEditing(true);
  };

  // Same commit rules as the case title editor: Enter or blur saves, Escape cancels, and an
  // empty or unchanged title is simply dropped rather than sent.
  const commit = () => {
    const trimmed = draft.trim();
    setIsEditing(false);
    if (!trimmed || trimmed === risk.title) return;
    updateRisk.mutate({ riskId: risk.id, title: trimmed });
  };

  const iconButton =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors cursor-pointer hover:bg-muted dark:hover:bg-overlay-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="group/issue -mx-2 flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-[14px] leading-relaxed text-foreground hover:bg-muted/40">
      <AlertCircle className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
      {isEditing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setIsEditing(false);
            }
          }}
          aria-label={t("overview.editIssue")}
          className="min-w-0 flex-1 border-b border-brand-gold bg-transparent outline-none"
        />
      ) : (
        <span className={`min-w-0 flex-1 break-words ${updateRisk.isPending ? "opacity-60" : ""}`}>
          {updateRisk.isPending ? updateRisk.variables?.title : risk.title}
          {updateRisk.isError && (
            <span className="ml-2 text-xs text-destructive">{t("overview.issueSaveFailed")}</span>
          )}
        </span>
      )}
      {!isEditing && (
        // Always visible on touch (no hover), revealed on hover/focus with a mouse.
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover/issue:opacity-100 md:group-focus-within/issue:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={startEditing}
                disabled={updateRisk.isPending}
                aria-label={t("overview.editIssue")}
                className={`${iconButton} hover:text-foreground`}
              >
                {updateRisk.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("overview.editIssue")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onDelete}
                disabled={updateRisk.isPending}
                aria-label={t("overview.deleteIssue")}
                className={`${iconButton} hover:text-red-600 dark:hover:text-red-400`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("overview.deleteIssue")}</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

/** Styled after DeleteDocumentModal — same header / warning body / footer layout. */
function DeleteKeyIssueModal({
  title,
  isDeleting,
  failed,
  onConfirm,
  onClose,
}: {
  title: string;
  isDeleting: boolean;
  failed: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("case-portfolio");

  return (
    <Dialog open onOpenChange={(open) => !open && !isDeleting && onClose()}>
      <DialogContent role="alertdialog" showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border bg-muted/60 px-6 py-5">
          <DialogTitle asChild>
            <h2 className="font-['Libre_Caslon_Text'] text-lg font-normal text-foreground">{t("overview.deleteIssue")}</h2>
          </DialogTitle>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="-m-1 rounded-full p-1.5 text-muted-foreground transition-colors cursor-pointer hover:bg-muted hover:text-foreground dark:hover:bg-overlay-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={t("editModal.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-4 px-6 py-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400">
            <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-2">
            <DialogDescription asChild>
              <p className="text-sm leading-relaxed text-foreground">{t("overview.deleteIssueConfirm", { title })}</p>
            </DialogDescription>
            {failed && <p className="text-xs text-destructive">{t("overview.issueDeleteFailed")}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/40 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors cursor-pointer hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("editModal.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors cursor-pointer hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {t("overview.deleteIssue")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
