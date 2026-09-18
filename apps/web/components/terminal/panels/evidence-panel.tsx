import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ChevronRight, FolderPlus, Loader2, Plus, Trash2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { CaseTimelineView } from "@/components/cases/case-timeline"
import { EvidenceDetailDrawer } from "@/components/terminal/evidence-detail-drawer"
import DeleteDocumentModal from "@/components/terminal/delete-document-modal"
import { useUploadCaseDocumentsMutation, useDeleteCaseDocumentMutation } from "@/lib/cases/mutations"
import { ALLOWED_EXTENSIONS, ALLOWED_FILE_TYPES_LABEL, isAllowedFileType, MAX_FILE_SIZE_BYTES } from "@/lib/cases/upload-batch"
import { useFileDrop } from "@/hooks/use-file-drop"
import type {
  CaseSnapshot,
  HearsayCategory,
  PrivilegeStatus,
  SnapshotDocument,
  SnapshotEvidenceMatrixItem,
  Witness,
} from "@/lib/terminal/types"
import { EmptyNote, PanelBody, SectionLabel } from "@/components/terminal/panel-kit"

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
  if (status === "READY") {
    return (
      <Badge tone="success" shape="pill">
        {t("ragReady")}
      </Badge>
    )
  }
  if (status === "FAILED") {
    return (
      <Badge tone="danger" shape="pill">
        {t("ragFailed")}
      </Badge>
    )
  }
  return (
    <Badge tone="neutral" shape="pill">
      {t("ragPending")}
    </Badge>
  )
}

function EvidenceRowPills({
  matrixItem,
  witnesses,
}: {
  matrixItem: SnapshotEvidenceMatrixItem | undefined
  witnesses: Witness[]
}) {
  const { t } = useTranslation("terminal")
  const custodyCount = matrixItem?.custodyEvents.length ?? 0
  const sponsoringWitness = matrixItem?.sponsoringWitnessId
    ? witnesses.find((w) => w.id === matrixItem.sponsoringWitnessId)
    : undefined

  return (
    <div className="flex w-full flex-wrap items-center gap-1">
      {matrixItem && matrixItem.privilegeStatus !== "NONE" ? (
        <Badge tone="caution">
          {t(PRIVILEGE_STATUS_KEYS[matrixItem.privilegeStatus])}
        </Badge>
      ) : null}
      {matrixItem && matrixItem.hearsayCategory !== "NOT_APPLICABLE" ? (
        <Badge tone="neutral">
          {t(HEARSAY_CATEGORY_KEYS[matrixItem.hearsayCategory])}
        </Badge>
      ) : null}
      <Badge tone={sponsoringWitness ? "success" : "neutral"}>
        {sponsoringWitness ? sponsoringWitness.name : t("noSponsoringWitness")}
      </Badge>
      <Badge tone={custodyCount === 0 ? "caution" : "neutral"}>
        {t("custodyEventCount", { n: custodyCount })}
      </Badge>
    </div>
  )
}

// Sentinel key for documents with no category — never a real folder name (Workspace's own
// "+ New folder" flow trims and requires a non-empty name before it'll let you drop into one),
// so this can't collide with an actual category a lawyer named.
const UNCATEGORIZED_KEY = "__uncategorized__"

/** Groups a flat document list into the same "folders" the Workspace document browser derives
 * from `category` (see DocumentFolderBrowser) — no separate folder concept, just this field.
 * Sorted alphabetically by folder name, with the uncategorized bucket pinned last since it's a
 * fallback, not a real category; documents keep the order the snapshot already returned them in
 * (this only groups, it doesn't introduce a second sort). */
function groupDocumentsByFolder(documents: SnapshotDocument[]): { key: string; label: string | null; docs: SnapshotDocument[] }[] {
  const groups = new Map<string, SnapshotDocument[]>()
  for (const doc of documents) {
    const key = doc.category?.trim() || UNCATEGORIZED_KEY
    const bucket = groups.get(key)
    if (bucket) bucket.push(doc)
    else groups.set(key, [doc])
  }
  const named = [...groups.entries()]
    .filter(([key]) => key !== UNCATEGORIZED_KEY)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, docs]) => ({ key, label: key, docs }))
  const uncategorized = groups.get(UNCATEGORIZED_KEY)
  return uncategorized ? [...named, { key: UNCATEGORIZED_KEY, label: null, docs: uncategorized }] : named
}

function DocumentRow({
  doc,
  matrixItem,
  witnesses,
  onOpen,
  onDelete,
  isDeleting,
}: {
  doc: SnapshotDocument
  matrixItem: SnapshotEvidenceMatrixItem | undefined
  witnesses: Witness[]
  onOpen: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const { t } = useTranslation("terminal")
  return (
    <li className="group flex w-full items-start gap-1 rounded-md transition-colors hover:bg-muted dark:hover:bg-overlay-hover">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col items-start gap-1 rounded-md px-1 py-1.5 text-left"
      >
        <div className="flex w-full items-center justify-between gap-3">
          <span className="min-w-0 flex-1 truncate text-[13px] text-foreground" title={doc.name}>
            {doc.name}
          </span>
          <TerminalRagBadge status={doc.ragStatus} />
        </div>
        <EvidenceRowPills matrixItem={matrixItem} witnesses={witnesses} />
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onDelete}
            aria-label={t("removeDocument", { documentName: doc.name })}
            className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors group-hover:opacity-100 hover:bg-danger/10 hover:text-danger disabled:opacity-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
  // Collapsed by default (empty set) — a folder's document count is visible without opening it,
  // and this panel also has the Timeline section below the document list that several
  // auto-expanded folders would otherwise push well down the pane. Not persisted across
  // reloads — resets collapsed every time this panel mounts.
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  // Folders a lawyer just created but hasn't dropped a file into yet. A folder only really
  // exists once a document actually carries its name as `category` (see groupDocumentsByFolder
  // below) — same model as Workspace's DocumentFolderBrowser, whose "+ New folder" just opens an
  // empty view and waits for a drop. Tracked here purely so the empty folder is visible at all
  // until that first upload lands and it becomes a real group.
  const [pendingFolders, setPendingFolders] = useState<string[]>([])
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Which category the next file-picker selection uploads into — set right before opening the
  // OS picker (a plain ref, not state: it's read once in the picker's own onChange, never
  // rendered, so it doesn't need to trigger a re-render).
  const uploadTargetRef = useRef<string | undefined>(undefined)

  const uploadDocuments = useUploadCaseDocumentsMutation()
  const upload = (files: File[], category?: string) => {
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
      { files: withinSizeLimit, caseId, category },
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
    // The pending placeholder's only job was to keep an empty folder visible until a real
    // document lands in it — once that upload is in flight, groupDocumentsByFolder will pick
    // the category up for real as soon as the snapshot refetches.
    if (category) setPendingFolders((prev) => prev.filter((name) => name !== category))
  }
  const { isDragOver, hoverTarget, dragHandlers } = useFileDrop(upload, undefined)

  const { mutate: deleteDocument, isPending: isDeleting, variables: deletingVars } = useDeleteCaseDocumentMutation()

  const openDocument =
    snapshot.documents.find((doc) => doc.id === openDocumentId) ?? null
  const openMatrixItem = snapshot.evidence.matrix.find(
    (m) => m.documentId === openDocumentId
  )

  // A document only gets AI-categorized as part of extraction (see DocumentExtractionSvc.process
  // on the backend), which finishes around the same time it flips to READY — so a still-indexing
  // (or failed) document almost always has no category yet, not because a lawyer or the AI put
  // it there deliberately. Folding it into "Uncategorized" would bury it inside a
  // collapsed-by-default folder instead of showing it as the in-progress upload it actually is —
  // so it renders as a loose row above the folders instead, same as any other document, until it
  // resolves to READY and (if categorized) joins a real folder on the next snapshot refetch.
  const indexingDocuments = snapshot.documents.filter((doc) => doc.ragStatus !== "READY")
  const readyDocuments = snapshot.documents.filter((doc) => doc.ragStatus === "READY")
  const realFolders = groupDocumentsByFolder(readyDocuments)
  const realFolderNames = new Set(realFolders.map((f) => f.label))
  const folders = [
    ...realFolders,
    ...pendingFolders
      .filter((name) => !realFolderNames.has(name))
      .map((name) => ({ key: name, label: name as string | null, docs: [] as SnapshotDocument[] })),
  ].sort((a, b) => {
    if (a.label === null) return 1
    if (b.label === null) return -1
    return a.label.localeCompare(b.label)
  })

  const toggleFolder = (key: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const triggerUpload = (category?: string) => {
    uploadTargetRef.current = category
    fileInputRef.current?.click()
  }

  return (
    <PanelBody gap="4">
      <div {...dragHandlers} className="relative rounded-lg">
        <div className="mb-2 flex items-center justify-between gap-2">
          <SectionLabel>
            {t("documents")} ({snapshot.documents.length})
          </SectionLabel>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={uploadDocuments.isPending}
                onClick={() => triggerUpload(undefined)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2 py-1 text-[11px] font-semibold text-brand-gold transition-colors hover:border-brand-gold/50 hover:bg-brand-gold/15 disabled:cursor-wait disabled:opacity-60"
              >
                {uploadDocuments.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="h-3 w-3" aria-hidden="true" />
                )}
                {uploadDocuments.isPending ? t("uploading") : t("addDocument")}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("dropToUpload")}</TooltipContent>
          </Tooltip>
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
            if (files.length > 0) upload(files, uploadTargetRef.current)
          }}
        />
        {snapshot.documents.length === 0 && folders.length === 0 ? (
          <EmptyNote>{t("noDocuments")}</EmptyNote>
        ) : (
          <div className="space-y-1">
            {indexingDocuments.length > 0 && (
              <ul className="space-y-1">
                {indexingDocuments.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    matrixItem={snapshot.evidence.matrix.find((m) => m.documentId === doc.id)}
                    witnesses={snapshot.witnesses}
                    onOpen={() => setOpenDocumentId(doc.id)}
                    onDelete={() => setDeletingDoc(doc)}
                    isDeleting={isDeleting && deletingVars?.documentId === doc.id}
                  />
                ))}
              </ul>
            )}
            {folders.map((folder) => {
              const expanded = expandedFolders.has(folder.key)
              return (
                <div
                  key={folder.key}
                  data-drop-target={folder.label ?? undefined}
                  className={`rounded-md ${hoverTarget === folder.label ? "bg-primary/10 ring-1 ring-primary/40" : ""}`}
                >
                  <div className="flex w-full items-center gap-1 rounded-md py-1 pr-0.5 pl-1 transition-colors hover:bg-muted dark:hover:bg-overlay-hover">
                    <button
                      type="button"
                      onClick={() => toggleFolder(folder.key)}
                      aria-expanded={expanded}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                      <ChevronRight
                        className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
                        aria-hidden="true"
                      />
                      <span
                        className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[1px] text-foreground uppercase"
                        title={folder.label ?? t("uncategorizedFolder")}
                      >
                        {folder.label ?? t("uncategorizedFolder")}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{folder.docs.length}</span>
                    </button>
                    {folder.label && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => triggerUpload(folder.label ?? undefined)}
                            aria-label={t("addDocument")}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-overlay-hover"
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("addDocument")}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {expanded &&
                    (folder.docs.length === 0 ? (
                      <p className="py-2 pl-5 text-[11px] text-muted-foreground">{t("emptyFolder")}</p>
                    ) : (
                      <ul className="space-y-1 pl-5">
                        {folder.docs.map((doc) => (
                          <DocumentRow
                            key={doc.id}
                            doc={doc}
                            matrixItem={snapshot.evidence.matrix.find((m) => m.documentId === doc.id)}
                            witnesses={snapshot.witnesses}
                            onOpen={() => setOpenDocumentId(doc.id)}
                            onDelete={() => setDeletingDoc(doc)}
                            isDeleting={isDeleting && deletingVars?.documentId === doc.id}
                          />
                        ))}
                      </ul>
                    ))}
                </div>
              )
            })}
            {creatingFolder ? (
              <div className="flex items-center gap-2 rounded-md px-1 py-1">
                <FolderPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  autoFocus
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const trimmed = newFolderName.trim()
                      if (trimmed) {
                        setPendingFolders((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
                        setExpandedFolders((prev) => new Set(prev).add(trimmed))
                      }
                      setCreatingFolder(false)
                      setNewFolderName("")
                    }
                    if (e.key === "Escape") {
                      setCreatingFolder(false)
                      setNewFolderName("")
                    }
                  }}
                  placeholder={t("folderNamePrompt")}
                  className="h-6 flex-1 rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCreatingFolder(false)
                    setNewFolderName("")
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {t("cancel")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingFolder(true)}
                className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-[11px] font-semibold tracking-[1px] text-muted-foreground uppercase transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-overlay-hover"
              >
                <FolderPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t("newFolder")}
              </button>
            )}
          </div>
        )}
        {isDragOver && !hoverTarget && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-card/90">
            <span className="text-sm font-semibold text-primary">{t("dropToUpload")}</span>
          </div>
        )}
      </div>

      <div>
        <SectionLabel>{t("timeline")}</SectionLabel>
        <CaseTimelineView caseId={caseId} fill={false} />
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
