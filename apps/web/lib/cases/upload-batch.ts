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

/** Straight to S3 — not apiFetch, so we never attach the API bearer token to a third-party URL. */
export async function putFileToS3(uploadUrl: string, file: File): Promise<void> {
  let putRes: Response
  try {
    putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    })
  } catch (err) {
    throw new Error(`Network error uploading to storage: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!putRes.ok) {
    const body = await putRes.text().catch(() => "")
    throw new Error(`Upload to storage failed (${putRes.status})${body ? `: ${body.slice(0, 200)}` : ""}`)
  }
}
