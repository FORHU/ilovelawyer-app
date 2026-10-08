const STORAGE_KEY = "terminalDismissedChangeSummaries"
// Oldest cases fall off past this, so the map can't grow without bound.
const MAX_CASES = 200

type Dismissed = Record<string, string> // caseId → id of the last change summary dismissed there

// Banners on this page, told when a dismissal is written here; other tabs hear the storage event.
const listeners = new Set<() => void>()
// This page's own dismissals, so one still holds where storage is blocked (a private window).
const dismissedHere: Dismissed = {}

/** For useSyncExternalStore: calls back when a dismissal changes, in this tab or another. */
export function subscribeDismissedChangeSummaries(onChange: () => void): () => void {
  listeners.add(onChange)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onStorage)
  }
}

function readAll(): Dismissed {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Dismissed) : {}
  } catch {
    return {}
  }
}

/** The change summary this browser last closed in the case's "What changed" modal, if any — the
 * modal opens by itself only for a newer one. Per viewer and per browser by design: closing it
 * marks it seen for you, not for the rest of the team. Storage that is blocked or cleared just
 * means it opens again. */
export function readDismissedChangeSummary(caseId: string): string | null {
  const id = dismissedHere[caseId] ?? readAll()[caseId]
  return typeof id === "string" ? id : null
}

export function writeDismissedChangeSummary(caseId: string, summaryId: string): void {
  dismissedHere[caseId] = summaryId
  try {
    const all = readAll()
    delete all[caseId]
    all[caseId] = summaryId
    const entries = Object.entries(all)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries.slice(-MAX_CASES))))
  } catch {
    // Storage unavailable — the dismissal lasts until the page reloads.
  }
  for (const onChange of listeners) onChange()
}
