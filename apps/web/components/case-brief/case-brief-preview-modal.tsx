"use client"

import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { useExportCaseBriefMutation } from "@/lib/terminal/mutations"
import { triggerBriefDownload } from "@/lib/terminal/download-brief"

/** Shared by both the Legal Terminal header and Case Workspace's Studio Panel — one "Download
 * case brief" control opens this same modal from either mount point, satisfying the ticket's
 * "one control" requirement without a dropdown/menu primitive (none exists in packages/ui).
 *
 * Preview always renders the PDF rendering, even when the lawyer's actual download is Word —
 * settled via grilling: converting/embedding the real .docx for preview would need a third-party
 * viewer (Office Online), which would expose a confidential case document's URL to Microsoft's
 * servers just to preview it. Reuses the PDF renderer already built for the PDF download instead.
 * "Download PDF" reuses the already-fetched preview file (no second network call); "Download
 * Word" is a genuinely separate render, not a conversion of the preview — see
 * CaseBriefExportSvc on the backend, which renders each format independently from the same
 * BriefDocument model. */
export function CaseBriefPreviewModal({
  caseId,
  open,
  onOpenChange,
}: {
  caseId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation("terminal")
  // Two separate mutation instances: the Word download must not clobber the PDF preview's own
  // `data`/`isPending` state, since they're independent server-side renders (see the file-level
  // comment above) and both call the same underlying hook/endpoint with a different format.
  const preview = useExportCaseBriefMutation(caseId)
  const wordDownload = useExportCaseBriefMutation(caseId)

  useEffect(() => {
    if (open) preview.mutate("pdf")
    // Regenerate fresh every time the modal opens rather than caching across opens — the brief
    // should reflect the live snapshot, same as the export endpoint itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const previewUrl = preview.data?.file.fileUrl

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-full max-w-4xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("caseBriefPreviewTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden rounded-lg border border-border bg-muted/20">
          {preview.isPending && (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("caseBriefGenerating")}
            </div>
          )}
          {preview.isError && (
            <div className="flex h-full items-center justify-center text-sm text-destructive">
              {t("caseBriefPreviewError")}
            </div>
          )}
          {previewUrl && (
            <iframe src={previewUrl} title={t("caseBriefPreviewTitle")} className="h-full w-full" />
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={wordDownload.isPending}
            onClick={() =>
              wordDownload.mutate("docx", {
                onSuccess: (result) => triggerBriefDownload(result.file.fileUrl),
              })
            }
          >
            {wordDownload.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t("downloadWord")}
          </Button>
          <Button disabled={!previewUrl} onClick={() => previewUrl && triggerBriefDownload(previewUrl)}>
            {t("downloadPdf")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
