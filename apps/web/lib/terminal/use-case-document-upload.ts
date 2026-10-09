import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useUploadCaseDocumentsMutation } from "@/lib/cases/mutations"
import { useCanContributeToCase } from "@/lib/cases/permissions"
import { ALLOWED_FILE_TYPES_LABEL, isAllowedFileType, isWithinSizeLimit, oversizedFilesLabel } from "@/lib/cases/upload-batch"

/** Uploads files to a case from a Terminal pane: drops unsupported/oversized files with a toast
 * each, uploads the rest, and toasts every per-file failure the mutation collects (presign / S3 /
 * confirm) so a lawyer can tell a network blip apart from a file the backend rejected. Shared by
 * the Evidence and finding panes — uploads land in the case's one document pool either way. */
export function useCaseDocumentUpload(caseId: string) {
  const { t } = useTranslation("terminal")
  const uploadDocuments = useUploadCaseDocumentsMutation()
  // A view-only person on a confidential case can't upload (see useCanContributeToCase) — the panes
  // hide their upload controls on this.
  const canUpload = useCanContributeToCase(caseId)

  const upload = (files: File[]) => {
    const [supported, unsupported] = [files.filter(isAllowedFileType), files.filter((f) => !isAllowedFileType(f))]
    if (unsupported.length > 0) {
      toast.error(
        t("attachmentUnsupportedType", {
          defaultValue: `${unsupported.map((f) => f.name).join(", ")} — unsupported file type, wasn't added. Supported formats: ${ALLOWED_FILE_TYPES_LABEL}.`,
          fileNames: unsupported.map((f) => f.name).join(", "),
          formats: ALLOWED_FILE_TYPES_LABEL,
        }),
      )
    }

    const [withinSizeLimit, oversized] = [
      supported.filter(isWithinSizeLimit),
      supported.filter((f) => !isWithinSizeLimit(f)),
    ]
    if (oversized.length > 0) {
      toast.error(
        t("attachmentTooLarge", {
          defaultValue: `${oversizedFilesLabel(oversized)} — over the per-file size limit, wasn't added.`,
          fileNames: oversizedFilesLabel(oversized),
        }),
      )
    }
    if (withinSizeLimit.length === 0) return

    uploadDocuments.mutate(
      { files: withinSizeLimit, caseId },
      {
        onSuccess: (result) => {
          result.failed.forEach(({ file, reason }) => {
            toast.error(`${file.name} — ${reason}`)
          })
        },
      },
    )
  }

  return { upload, isUploading: uploadDocuments.isPending, canUpload }
}
