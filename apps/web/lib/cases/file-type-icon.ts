import { File, FileImage, FileSpreadsheet, FileText, Mail, type LucideIcon } from "lucide-react"

interface FileTypeInput {
  mimeType: string | null
  name: string
}

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".")
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase()
}

// Extension shown on the file badge when the filename has none (blank names are rare, but a
// generic MIME type is common on Windows uploads — see fileTypeIcon).
const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/csv": "csv",
  "message/rfc822": "eml",
}

/** Uppercase extension for a document's badge ("PDF", "DOCX"), from the uploaded filename first,
 * then the MIME type. Empty when neither says anything. Capped at 4 chars to fit the badge. */
export function fileExtensionLabel({ mimeType, name }: FileTypeInput) {
  const ext = extensionOf(name) || (mimeType ? (EXT_BY_MIME[mimeType] ?? "") : "")
  return ext.slice(0, 4).toUpperCase()
}

export function isSpreadsheet({ mimeType, name }: FileTypeInput) {
  const ext = extensionOf(name)
  return (
    !!mimeType?.includes("spreadsheet") ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "text/csv" ||
    ["xls", "xlsx", "csv"].includes(ext)
  )
}

/** Text colour for a document's badge, by file family (700 in light mode keeps the 8px extension
 * label above AA contrast on the muted tile; 400 in dark). Unknown types stay neutral. */
export function fileTypeColorClass(doc: FileTypeInput) {
  const ext = extensionOf(doc.name)
  const { mimeType } = doc
  if (isSpreadsheet(doc)) return "text-green-700 dark:text-green-400"
  if (mimeType === "application/pdf" || ext === "pdf") return "text-red-700 dark:text-red-400"
  if (mimeType?.includes("word") || ["doc", "docx", "rtf"].includes(ext)) return "text-blue-700 dark:text-blue-400"
  if (mimeType?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "heic", "tif", "tiff"].includes(ext)) {
    return "text-amber-700 dark:text-amber-400"
  }
  if (mimeType === "message/rfc822" || ["eml", "msg"].includes(ext)) return "text-teal-700 dark:text-teal-400"
  return "text-muted-foreground"
}

/** Icon for a document row, from the MIME type first and the file extension as a fallback (a
 * blank/generic `mimeType` is common on Windows uploads — see upload-batch.ts). */
export function fileTypeIcon(doc: FileTypeInput): LucideIcon {
  const { mimeType, name } = doc
  const ext = extensionOf(name)
  if (isSpreadsheet(doc)) return FileSpreadsheet
  if (mimeType?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "heic", "tif", "tiff"].includes(ext)) {
    return FileImage
  }
  if (mimeType === "message/rfc822" || ["eml", "msg"].includes(ext)) return Mail
  if (
    mimeType === "application/pdf" ||
    mimeType?.startsWith("text/") ||
    mimeType?.includes("word") ||
    ["pdf", "doc", "docx", "txt", "rtf"].includes(ext)
  ) {
    return FileText
  }
  return File
}
