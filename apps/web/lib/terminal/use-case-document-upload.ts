import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useUploadCaseDocumentsMutation } from "@/lib/cases/mutations"
import { ALLOWED_FILE_TYPES_LABEL, isAllowedFileType, MAX_FILE_SIZE_BYTES } from "@/lib/cases/upload-batch"

/** Uploads files to a case from a Terminal pane: drops unsupported/oversized files with a toast
 * each, uploads the rest, and toasts every per-file failure the mutation collects (presign / S3 /
 * confirm) so a lawyer can tell a network blip apart from a file the backend rejected. Shared by
 * the Evidence and finding panes — uploads land in the case's one document pool either way. */
export function useCaseDocumentUpload(caseId: string) {
  const { t } = useTranslation("terminal")
  const uploadDocuments = useUploadCaseDocumentsMutation()

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
      supported.filter((f) => f.size <= MAX_FILE_SIZE_BYTES),
      supported.filter((f) => f.size > MAX_FILE_SIZE_BYTES),
    ]
    if (oversized.length > 0) {
      toast.error(
        t("attachmentTooLarge", {
          defaultValue: `${oversized.map((f) => f.name).join(", ")} — over the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit per file, wasn't added.`,
          fileNames: oversized.map((f) => f.name).join(", "),
          maxMb: MAX_FILE_SIZE_BYTES / (1024 * 1024),
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

  return { upload, isUploading: uploadDocuments.isPending }
}
