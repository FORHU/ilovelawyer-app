/** Triggers a browser download of a presigned S3 URL — no download/blob pattern existed
 * elsewhere in this app before the Case Brief export (only presigned-URL-in-`<audio>` playback,
 * see use-audio-overview.ts). `download=""` (empty, not a filename) hints "download this,
 * don't navigate" while leaving the actual filename to the URL/Content-Disposition. */
export function triggerBriefDownload(fileUrl: string) {
  const a = document.createElement("a")
  a.href = fileUrl
  a.download = ""
  a.target = "_blank"
  document.body.appendChild(a)
  a.click()
  a.remove()
}
