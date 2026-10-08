import type { CaseChangeSummary } from "./change-summary"
import type { PanelId } from "./types"

// Lawyers' manual edits in the Terminal's panes, grouped into editing sessions — the "What changed"
// modal shows them beside the AI runs. Mirrors ilovelawyer-api's types/manual-edit.ts and
// CaseManualEditSvc's responses; change both together.

export type ManualEditAction =
  | "added"
  | "edited"
  | "removed"
  | "resolved"
  | "dismissed"
  | "reopened"
  | "ticked"
  | "unticked"
  | "accepted"
  | "awarded"
  | "disputed"
  | "reactivated"
  | "published"
  | "retired"
  | "forked"
  | "confirmed"
  | "unconfirmed"
  | "recomputed"
  | "expanded"
  | "reverted"

export type ManualEditValue = string | number | boolean | null

/** One field an edit changed. Short values keep from/to; long text only names the field. */
export interface ManualEditChange {
  field: string
  from?: ManualEditValue
  to?: ManualEditValue
}

export interface ManualEdit {
  id: string
  /** The Terminal pane the item shows in. */
  pane: PanelId
  kind: string
  itemId: string | null
  action: ManualEditAction
  /** The item's name when it was edited, kept after a delete. */
  label: string
  changes: ManualEditChange[] | null
  createdAt: string
}

/** One person's edits with no gap over 30 minutes and no AI run in between. */
export interface EditSession {
  id: string
  actorId: string | null
  actorName: string | null
  startedAt: string
  endedAt: string
  editCount: number
  edits: ManualEdit[]
}

/** GET /change-summaries/:id/edits-before — the edits lawyers made since the previous run. */
export interface EditsBeforeRun {
  count: number
  actors: { id: string | null; name: string | null }[]
  firstSession: { id: string; startedAt: string } | null
}

export type HistoryFilter = "all" | "analysis" | "edits"

/** One History entry: an AI run (a refresh or a pane's Regenerate) or an editing session. */
export type HistoryItem =
  | { type: "run"; key: string; at: string; run: CaseChangeSummary }
  | { type: "edits"; key: string; at: string; session: EditSession }

export const runKey = (id: string) => `run:${id}`
export const sessionKey = (id: string) => `edits:${id}`

/** A day's History: its runs and editing sessions, newest first (a session by when it ended),
 * narrowed by the All / Analysis / Edits filter. */
export function mergeHistory(runs: CaseChangeSummary[], sessions: EditSession[], filter: HistoryFilter): HistoryItem[] {
  const items: HistoryItem[] = [
    ...(filter === "edits" ? [] : runs.map((run) => ({ type: "run" as const, key: runKey(run.id), at: run.createdAt, run }))),
    ...(filter === "analysis" ? [] : sessions.map((session) => ({ type: "edits" as const, key: sessionKey(session.id), at: session.endedAt, session }))),
  ]
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

/** The Terminal's pane order, so a session's lines read the way the panes are laid out. */
const PANE_ORDER: PanelId[] = [
  "command",
  "evidence",
  "procedure",
  "witnesses",
  "damages",
  "legalIssues",
  "strengths",
  "weaknesses",
  "attackStrategy",
  "defenseStrategy",
  "redTeam",
  "law",
  "decisions",
  "theories",
  "caseReconstruction",
  "mindMap",
  "audioOverview",
]

/** A session's lines, one per pane in Terminal order: its edits in the order they were made, up to
 * `max` named, the rest counted. */
export function describeEditLines(session: EditSession, max = 4): { pane: PanelId; edits: ManualEdit[]; more: number }[] {
  const byPane = new Map<PanelId, ManualEdit[]>()
  for (const edit of session.edits) byPane.set(edit.pane, [...(byPane.get(edit.pane) ?? []), edit])
  const rank = (pane: PanelId) => {
    const i = PANE_ORDER.indexOf(pane)
    return i < 0 ? PANE_ORDER.length : i
  }
  return [...byPane.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([pane, edits]) => ({ pane, edits: edits.slice(0, max), more: Math.max(0, edits.length - max) }))
}

/** Who a session belongs to, from the viewer's side: "you" for their own, else the person's name
 * (null when the account was deleted — the modal says "Someone"). */
export function sessionAuthor(session: { actorId: string | null; actorName: string | null }, viewerId: string | null | undefined): "you" | string | null {
  if (viewerId && session.actorId === viewerId) return "you"
  return session.actorName
}

/** The newest History entry, or the one asked for when it's still on the list. */
export function pickHistoryItem(items: HistoryItem[], selectedKey: string | null): HistoryItem | undefined {
  return items.find((item) => item.key === selectedKey) ?? items[0]
}
