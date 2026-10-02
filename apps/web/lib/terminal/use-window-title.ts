import { useEffect } from "react"

/**
 * Names this page's window/tab while it's shown — e.g. "Legal Terminal — Smith v Jones" — and puts
 * the previous title back on the way out, so a browser tab doesn't keep a stale name after
 * navigating elsewhere.
 *
 * In the desktop app every window used to be titled the same, so the dashboard and a case's Legal
 * Terminal couldn't be told apart in the title bar or taskbar. The app shows this title for
 * Terminal and panel windows, with the UK/PH site in front (src-tauri: on_document_title_changed).
 * Does nothing until `title` is known (e.g. while the case is loading).
 */
export function useWindowTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}
