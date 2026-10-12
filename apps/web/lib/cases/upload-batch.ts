/** Matches ilovelawyer-api DOCUMENT_UPLOAD_BATCH_MAX — confirm/presign reject larger arrays. */
export const CONFIRM_BATCH_SIZE = 50

/** Concurrent S3 PUTs (and per-file work after a batch presign). Stay inside the browser's ~6–10 connection pool. */
export const UPLOAD_CONCURRENCY = 8

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size) as T[])
  return out
}

/** Like Promise.allSettled, but at most `concurrency` fns run at once. */
export async function mapPoolSettled<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let next = 0

  async function worker() {
    while (true) {
      const index = next++
      if (index >= items.length) return
      try {
        results[index] = { status: "fulfilled", value: await fn(items[index] as T, index) }
      } catch (reason) {
        results[index] = { status: "rejected", reason }
      }
    }
  }

  const workers = Math.min(Math.max(concurrency, 1), items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

/** Windows browsers in particular often leave File.type blank for .docx/.xlsx (and others). An
 * empty Content-Type breaks the upload chain — the presign/confirm Joi schemas reject an empty
 * string, and even where they don't, the browser may substitute its own value on the actual PUT,
 * which no longer matches what was signed and gets a 403 from S3. Resolve a real value from the
 * extension once per file and reuse it for the presign request, the S3 PUT header, and the
 * confirm call's mimeType so all three always agree. */
const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  xlam: "application/vnd.ms-excel.addin.macroEnabled.12",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
}

export function resolveContentType(file: File): string {
  if (file.type) return file.type
  const ext = file.name.split(".").pop()?.toLowerCase()
  return (ext && EXTENSION_CONTENT_TYPES[ext]) || "application/octet-stream"
}

/** The formats Document Analysis / case evidence upload declares support for. Drives both the
 * `<input accept>` hints and the actual pre-upload rejection below — `accept` alone doesn't stop
 * drag-and-drop or an "All files" picker choice, so callers must still filter through
 * `isAllowedFileType`. */
export const ALLOWED_EXTENSIONS = Object.keys(EXTENSION_CONTENT_TYPES)

export const ALLOWED_FILE_TYPES_LABEL = "PDF, DOC, DOCX, XLSX, XLSM, XLAM, TXT, JPG, PNG, MP3, MP4"

export const UNSUPPORTED_FILE_TYPE_MESSAGE = `Unsupported file type. Supported formats: ${ALLOWED_FILE_TYPES_LABEL}.`

export function isAllowedFileType(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase()
  return !!ext && ALLOWED_EXTENSIONS.includes(ext)
}

/** Most one upload — everything a person picks or drops at once, plus files already queued on
 * the same screen — may total. There is no separate per-file cap. Matches ilovelawyer-api's
 * DOCUMENT_UPLOAD_BATCH_MAX_BYTES, which the API checks per presign/confirm request (up to
 * CONFIRM_BATCH_SIZE files); only this client sees a whole selection, so the 1 GB across a
 * selection split into several requests is enforced here alone. */
export const MAX_BATCH_SIZE_BYTES = 1024 ** 3

/** "1.4 GB", "350 MB" — binary units, matching how MAX_BATCH_SIZE_BYTES is defined. */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const rounded = unit === 0 ? String(value) : value.toFixed(1).replace(/\.0$/, "")
  return `${rounded} ${units[unit]}`
}

export interface UploadSelectionCheck {
  /** Files to upload — empty when the selection is over the limit (it's rejected whole). */
  accepted: File[]
  /** Unsupported file types, dropped before the total is taken. */
  unsupported: File[]
  /** The supported files plus `alreadyQueuedBytes` total over MAX_BATCH_SIZE_BYTES. */
  batchTooLarge: boolean
  /** Supported files' bytes plus `alreadyQueuedBytes`. */
  totalBytes: number
}

/** The one pre-upload check every upload surface runs: drop unsupported types, then reject the
 * whole selection if it — together with files already queued on that screen (Create Case's list,
 * chat's attachments) — totals over MAX_BATCH_SIZE_BYTES. Nothing half-uploads. */
export function checkUploadSelection(files: readonly File[], alreadyQueuedBytes = 0): UploadSelectionCheck {
  const supported = files.filter(isAllowedFileType)
  const unsupported = files.filter((f) => !isAllowedFileType(f))
  const totalBytes = supported.reduce((sum, f) => sum + f.size, alreadyQueuedBytes)
  const batchTooLarge = totalBytes > MAX_BATCH_SIZE_BYTES
  return { accepted: batchTooLarge ? [] : supported, unsupported, batchTooLarge, totalBytes }
}

/** Backstop for the upload mutations: throws if `files` total over MAX_BATCH_SIZE_BYTES, in case
 * a caller skipped checkUploadSelection. */
export function assertWithinBatchLimit(files: readonly File[]): void {
  const total = files.reduce((sum, f) => sum + f.size, 0)
  if (total > MAX_BATCH_SIZE_BYTES) {
    throw new Error(`These files total ${formatBytes(total)} — the limit is ${formatBytes(MAX_BATCH_SIZE_BYTES)} per upload.`)
  }
}

/** Straight to S3 — not apiFetch, so we never attach the API bearer token to a third-party URL.
 * `contentType` must be the exact value that was signed at presign time (see resolveContentType) —
 * S3 rejects a PUT whose Content-Type header doesn't match the signature with a 403. The URL also
 * signs the file's size; the browser sets Content-Length from the File itself, so they match.
 * XMLHttpRequest rather than fetch because only it reports upload progress (`onProgress`, 0–1),
 * which a file of several hundred MB needs to not look stuck. */
export function putFileToS3(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", uploadUrl)
    xhr.setRequestHeader("Content-Type", contentType)
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total)
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1)
        resolve()
        return
      }
      const body = typeof xhr.responseText === "string" ? xhr.responseText : ""
      reject(new Error(`Upload to storage failed (${xhr.status})${body ? `: ${body.slice(0, 200)}` : ""}`))
    }
    xhr.onerror = () => reject(new Error("Network error uploading to storage"))
    xhr.onabort = () => reject(new Error("Upload to storage was cancelled"))
    xhr.send(file)
  })
}
