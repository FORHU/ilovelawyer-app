import { createElement, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ChevronDown, Folder, Loader2, Plus, Trash2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { CaseTimelineView } from "@/components/cases/case-timeline"
import { EvidenceDetailDrawer } from "@/components/terminal/evidence-detail-drawer"
import DeleteDocumentModal from "@/components/terminal/delete-document-modal"
import { useUploadCaseDocumentsMutation, useDeleteCaseDocumentMutation } from "@/lib/cases/mutations"
import { ALLOWED_EXTENSIONS, ALLOWED_FILE_TYPES_LABEL, isAllowedFileType, MAX_FILE_SIZE_BYTES } from "@/lib/cases/upload-batch"
import { fileExtensionLabel, fileTypeColorClass, fileTypeIcon } from "@/lib/cases/file-type-icon"
import { countByStatus, documentSizeLabel, groupByCategory, ingestTone } from "@/lib/terminal/evidence-status"
import { useFileDrop } from "@/hooks/use-file-drop"
import type {
  CaseSnapshot,
  HearsayCategory,
  PrivilegeStatus,
  SnapshotDocument,
} from "@/lib/terminal/types"
import { EmptyNote, labelTextClass, PanelBody } from "@/components/terminal/panel-kit"

export const PRIVILEGE_STATUS_KEYS: Record<PrivilegeStatus, string> = {
  NONE: "privilegeNone",
  ATTORNEY_CLIENT: "privilegeAttorneyClient",
  WORK_PRODUCT: "privilegeWorkProduct",
}

export const HEARSAY_CATEGORY_KEYS: Record<HearsayCategory, string> = {
  DIRECT_EVIDENCE: "hearsayDirectEvidence",
  BUSINESS_RECORD: "hearsayBusinessRecord",
  PRESENT_SENSE_IMPRESSION: "hearsayPresentSenseImpression",
  EXCITED_UTTERANCE: "hearsayExcitedUtterance",
  OTHER_EXCEPTION: "hearsayOtherException",
  NOT_APPLICABLE: "hearsayNotApplicable",
}

function TerminalRagBadge({ status }: { status: string | null }) {
  const { t } = useTranslation("terminal")
  const tone = ingestTone(status)
  if (tone === "ready") {
    return (
      <Badge tone="success" shape="pill" className="border border-ok/40 bg-transparent">
        {t("ragReady")}
      </Badge>
    )
  }
  if (tone === "failed") {
    return (
      <Badge tone="danger" shape="pill" className="border border-danger/40 bg-transparent">
        {t("ragFailed")}
      </Badge>
    )
  }
  return (
    <Badge tone="caution" shape="pill" className="border border-warn/40 bg-transparent">
      {t("ragPending")}
    </Badge>
  )
}

/** Segmented ready / pending / failed bar plus its legend, proportional to the document counts. */
function StatusSummary({ documents }: { documents: SnapshotDocument[] }) {
  const { t } = useTranslation("terminal")
  const counts = countByStatus(documents)
  const segments = [
    { key: "ready", count: counts.ready, bar: "bg-ok", text: "text-ok", label: t("ragReady") },
    { key: "pending", count: counts.pending, bar: "bg-warn", text: "text-warn", label: t("ragPending") },
    { key: "failed", count: counts.failed, bar: "bg-danger", text: "text-danger", label: t("ragFailed") },
  ].filter((segment) => segment.count > 0)

  return (
    <div className="mb-3 space-y-2">
      <div className="flex h-1 w-full gap-px overflow-hidden rounded-full" aria-hidden="true">
        {segments.map((segment) => (
          <span key={segment.key} className={segment.bar} style={{ flexGrow: segment.count, flexBasis: 0 }} />
        ))}
      </div>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] font-semibold tracking-[1px] uppercase">
        {segments.map((segment) => (
          <li key={segment.key} className={`flex items-center gap-1.5 ${segment.text}`}>
            <span aria-hidden="true" className={`size-1.5 rounded-full ${segment.bar}`} />
            {segment.count} {segment.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DocumentRow({
  doc,
  onOpen,
  onDelete,
  isDeleting,
}: {
  doc: SnapshotDocument
  onOpen: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const { t } = useTranslation("terminal")
  const size = documentSizeLabel(doc)
  const sizeLabel = size ? t(size.key, { n: size.n }) : null
  return (
    <li className="group flex w-full items-center gap-1 transition-colors hover:bg-muted dark:hover:bg-overlay-hover">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left">
        <span
          aria-hidden="true"
          className={`flex size-10 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-border bg-muted ${fileTypeColorClass(doc)}`}
        >
          {createElement(fileTypeIcon(doc), { className: "size-4" })}
          <span className="font-mono text-[8px] font-semibold leading-none tracking-[0.5px]">{fileExtensionLabel(doc)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-foreground" title={doc.name}>
            {doc.name}
          </span>
          <span className="block font-mono text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase">
            {sizeLabel}
          </span>
        </span>
        <TerminalRagBadge status={doc.ragStatus} />
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onDelete}
            aria-label={t("removeDocument", { documentName: doc.name })}
            className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors group-hover:opacity-100 hover:bg-danger/10 hover:text-danger disabled:opacity-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("removeDocument", { documentName: doc.name })}</TooltipContent>
      </Tooltip>
    </li>
  )
}

export function EvidencePanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null)
  const [deletingDoc, setDeletingDoc] = useState<SnapshotDocument | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadDocuments = useUploadCaseDocumentsMutation()
  const upload = (files: File[]) => {
    const [supported, unsupported] = [
      files.filter(isAllowedFileType),
      files.filter((f) => !isAllowedFileType(f)),
    ]
    if (unsupported.length > 0) {
      toast.error(
        t("attachmentUnsupportedType", {
          defaultValue: `${unsupported.map((f) => f.name).join(", ")} — unsupported file type, wasn't added. Supported formats: ${ALLOWED_FILE_TYPES_LABEL}.`,
          fileNames: unsupported.map((f) => f.name).join(", "),
          formats: ALLOWED_FILE_TYPES_LABEL,
        })
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
        })
      )
    }
    if (withinSizeLimit.length === 0) return

    uploadDocuments.mutate(
      { files: withinSizeLimit, caseId },
      {
        // Per-file reasons the mutation itself already collects (presign/S3/confirm failures) —
        // surfaced individually rather than the one generic "couldn't upload" line this replaced,
        // so a lawyer can tell a transient network blip apart from a file the backend rejected.
        onSuccess: (result) => {
          result.failed.forEach(({ file, reason }) => {
            toast.error(`${file.name} — ${reason}`)
          })
        },
      },
    )
  }
  const { isDragOver, dragHandlers } = useFileDrop(upload, undefined)

  const { mutate: deleteDocument, isPending: isDeleting, variables: deletingVars } = useDeleteCaseDocumentMutation()

  const openDocument =
    snapshot.documents.find((doc) => doc.id === openDocumentId) ?? null
  const openMatrixItem = snapshot.evidence.matrix.find(
    (m) => m.documentId === openDocumentId
  )
  // Same categories Workspace's Studio panel shows as folders (DocumentFolderBrowser), rendered as
  // headed sections instead so every document, PENDING and FAILED included, stays in view.
  const documentGroups = groupByCategory(snapshot.documents)
  const hasCategories = documentGroups.some((group) => group.category !== null)
  // Categories start open; this holds the ones the lawyer has collapsed ("" = Uncategorized).
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const toggleCategory = (key: string) =>
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <PanelBody gap="4">
      <div {...dragHandlers} className="relative rounded-lg">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className={labelTextClass}>
            {t("documents")} · {snapshot.documents.length}
          </p>
          <div className="flex items-center gap-2">
            <p className={labelTextClass}>{t("clickRowForMetadata")}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={uploadDocuments.isPending}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={t("addDocument")}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full border border-brand-gold/30 bg-brand-gold/10 text-brand-gold transition-colors hover:border-brand-gold/50 hover:bg-brand-gold/15 disabled:cursor-wait disabled:opacity-60"
                >
                  {uploadDocuments.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="h-3 w-3" aria-hidden="true" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("dropToUpload")}</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ""
            if (files.length > 0) upload(files)
          }}
        />
        {snapshot.documents.length === 0 ? (
          <EmptyNote>{t("noDocuments")}</EmptyNote>
        ) : (
          <>
            <StatusSummary documents={snapshot.documents} />
            <div className="space-y-3">
              {documentGroups.map((group, index) => {
                const key = group.category ?? ""
                const label = group.category ?? t("uncategorizedFolder")
                const isOpen = !hasCategories || !collapsedCategories.has(key)
                const listId = `evidence-category-${index}`
                return (
                  <section key={key} aria-label={label}>
                    {/* A case with no categorised documents stays one plain list — an
                     * "Uncategorized" header over everything would add nothing. */}
                    {hasCategories ? (
                      <button
                        type="button"
                        onClick={() => toggleCategory(key)}
                        aria-expanded={isOpen}
                        aria-controls={listId}
                        className={`mb-1.5 flex w-full items-center gap-1.5 rounded-md py-1 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${labelTextClass}`}
                      >
                        <ChevronDown
                          className={`size-3 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                          aria-hidden="true"
                        />
                        <Folder className="size-3 shrink-0" aria-hidden="true" />
                        <span className="truncate" title={group.category ?? undefined}>
                          {label}
                        </span>
                        <span className="shrink-0">· {group.docs.length}</span>
                      </button>
                    ) : null}
                    {isOpen ? (
                      <ul id={listId} className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                        {group.docs.map((doc) => (
                          <DocumentRow
                            key={doc.id}
                            doc={doc}
                            onOpen={() => setOpenDocumentId(doc.id)}
                            onDelete={() => setDeletingDoc(doc)}
                            isDeleting={isDeleting && deletingVars?.documentId === doc.id}
                          />
                        ))}
                      </ul>
                    ) : null}
                  </section>
                )
              })}
            </div>
          </>
        )}
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-card/90">
            <span className="text-sm font-semibold text-primary">{t("dropToUpload")}</span>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <CaseTimelineView caseId={caseId} fill={false} title={<p className={labelTextClass}>{t("timeline")}</p>} />
      </div>

      <EvidenceDetailDrawer
        open={!!openDocumentId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setOpenDocumentId(null)
        }}
        caseId={caseId}
        document={openDocument}
        matrixItem={openMatrixItem}
        witnesses={snapshot.witnesses}
      />

      {deletingDoc && (
        <DeleteDocumentModal
          key={deletingDoc.id}
          doc={deletingDoc}
          isDeleting={isDeleting && deletingVars?.documentId === deletingDoc.id}
          onConfirm={() => {
            deleteDocument({ documentId: deletingDoc.id, caseId })
            setDeletingDoc(null)
          }}
          onClose={() => setDeletingDoc(null)}
        />
      )}
    </PanelBody>
  )
}
