/** Whether a past consultation title is fit to reuse as an empty-state suggested prompt. Titles
 * are model-generated as "[Legal Area]: [Specific Issue]", but ones saved before the API
 * validated them can be upstream error text ("[Error] Error code: 429 ...", saved when the model
 * was rate-limited) or an off-format echo of a non-legal message. Mirrors ilovelawyer-api's
 * ChatSvc.isValidTitle. */
export function isSuggestableTitle(title: string): boolean {
  const t = title.trim()
  if (!t || /^\[?error\]?/i.test(t)) return false
  return /^[^:]{2,}:\s*\S/.test(t)
}
