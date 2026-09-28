// Audit `action` strings are `<subject>.<verb>` slugs written by the API (e.g. "risk.create",
// "mindMap.expand", "case.grant_access"). Turns one into a short readable phrase for the Team &
// Audit log — "Risk added", "Mind map expanded" — falling back to the verb as-is for an action
// nobody has mapped yet, so a new API action still reads sensibly without a frontend change.
const VERB_LABEL: Record<string, string> = {
  create: "added",
  add: "added",
  update: "updated",
  delete: "removed",
  generate: "generated",
  extract: "extracted",
  archive: "archived",
  unarchive: "restored",
  refresh: "refreshed",
  recompute: "recomputed",
  confirm: "confirmed",
  dispute: "disputed",
  reactivate: "reactivated",
  fork: "forked",
  propose: "proposed",
  check: "checked",
  score: "scored",
  build: "built",
  expand: "expanded",
  edit: "edited",
  revert: "reverted",
  upsert: "saved",
  grant_access: "access granted",
}

const words = (slug: string) =>
  slug
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._]/g, " ")
    .toLowerCase()

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export function auditActionLabel(action: string): string {
  const parts = action.split(".")
  if (parts.length === 1) return sentenceCase(words(action))
  const verbKey = parts[parts.length - 1]!
  const subject = parts.slice(0, -1).join(" ")
  const verb = VERB_LABEL[verbKey] ?? words(verbKey)
  return sentenceCase(`${words(subject)} ${verb}`)
}

/** "Risk added" or, when the API recorded what it acted on, `Risk added: "No written protest"`. */
export function auditEventText(event: { action: string; subject?: string | null }): string {
  const label = auditActionLabel(event.action)
  return event.subject ? `${label}: “${event.subject}”` : label
}

/** Adds a live-pushed audit event to the top of the log (newest first). Idempotent by id, so an
 * event the snapshot refetch already contains — or a reconnect replay — isn't shown twice. */
export function withAuditEvent<T extends { id: string }>(audit: T[], event: T, limit = 200): T[] {
  if (audit.some((existing) => existing.id === event.id)) return audit
  return [event, ...audit].slice(0, limit)
}
