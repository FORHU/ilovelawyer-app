import { File, FileImage, FileSpreadsheet, FileText, Mail, type LucideIcon } from "lucide-react"

interface FileTypeInput {
  mimeType: string | null
  name: string
}

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".")
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase()
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
