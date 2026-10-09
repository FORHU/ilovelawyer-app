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

const MB = 1024 * 1024

/** Per-file cap for a case document (ilovelawyer-api#91). Mirrors ilovelawyer-api's
 * DOCUMENT_MAX_BYTES, which the API enforces against S3 at confirm time, so change both
 * together. Checking here too just refuses the file before it's uploaded instead of after. */
export const MAX_FILE_SIZE_BYTES = 25 * MB

/** Images get a smaller cap: the API OCRs them with Textract's synchronous call, which takes at
 * most 5 MB (ilovelawyer-api's IMAGE_DOCUMENT_MAX_BYTES). */
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png"]
export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * MB

export function maxFileSizeBytes(file: File): number {
  const ext = file.name.split(".").pop()?.toLowerCase()
  return ext && IMAGE_EXTENSIONS.includes(ext) ? MAX_IMAGE_FILE_SIZE_BYTES : MAX_FILE_SIZE_BYTES
}

export function isWithinSizeLimit(file: File): boolean {
  return file.size <= maxFileSizeBytes(file)
}

/** "bundle.pdf (100MB limit), scan.png (5MB limit)" — for the "wasn't added" toast, since the
 * limit differs between documents and images. */
export function oversizedFilesLabel(files: File[]): string {
  return files.map((f) => `${f.name} (${maxFileSizeBytes(f) / MB}MB limit)`).join(", ")
}

/** Straight to S3 — not apiFetch, so we never attach the API bearer token to a third-party URL.
 * `contentType` must be the exact value that was signed at presign time (see resolveContentType) —
 * S3 rejects a PUT whose Content-Type header doesn't match the signature with a 403. */
export async function putFileToS3(uploadUrl: string, file: File, contentType: string): Promise<void> {
  let putRes: Response
  try {
    putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": contentType },
    })
  } catch (err) {
    throw new Error(`Network error uploading to storage: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!putRes.ok) {
    const body = await putRes.text().catch(() => "")
    throw new Error(`Upload to storage failed (${putRes.status})${body ? `: ${body.slice(0, 200)}` : ""}`)
  }
}
