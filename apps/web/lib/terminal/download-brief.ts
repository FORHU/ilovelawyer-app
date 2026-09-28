/** Triggers a browser download of a Case Brief's `/files/<token>` link. The API signs the brief's
 * real filename into the token, so the Content-Disposition header normally names the file; the
 * `download` value here is the fallback. That fallback matters because the URL's last segment is
 * the JWT, and without either one the browser saves the file under the token, with no extension (#458).
 * The link is same-origin, so browsers honour `download` rather than ignoring it as they would
 * for a cross-origin URL. */
export function triggerBriefDownload(fileUrl: string, fallbackFilename: string) {
  const a = document.createElement("a")
  a.href = fileUrl
  a.download = fallbackFilename
  a.target = "_blank"
  document.body.appendChild(a)
  a.click()
  a.remove()
}
