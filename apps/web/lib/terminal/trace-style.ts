import type { TraceEvent, TraceTurn } from "@/lib/terminal/types"

/** The classes one kind of trace step is drawn with: its type pill, its dot and summary-bar
 * segment, its text, and the accent edge and tint of an opened explanation. */
export interface TraceStyle {
  badge: string
  bar: string
  text: string
  edge: string
  tint: string
  /** Border and background of a filter chip that is switched on. */
  chipOn: string
}

// Written out in full (not built from class fragments) so Tailwind sees every class. The first
// three reuse the Terminal's own semantic colors — the same values as TONE_STYLE in panel-kit —
// because those mean something there: gold for reasoning, green for found sources, orange for
// caution. The rest are plain hues with no meaning elsewhere in the Terminal (red is left out on
// purpose: it would read as an error, and a self-check is not one), each with a light and a dark
// shade so it keeps its contrast in both themes. Kept free of runtime imports so it stays a pure,
// testable module.
const REASONING: TraceStyle = {
  badge: "border-warn/40 bg-warn/5 text-warn",
  bar: "bg-warn/70",
  text: "text-warn",
  edge: "border-l-warn/70",
  tint: "bg-warn/[0.05]",
  chipOn: "border-warn bg-warn/15",
}
const RESEARCH: TraceStyle = {
  badge: "border-ok/50 bg-ok/10 text-ok",
  bar: "bg-ok",
  text: "text-ok",
  edge: "border-l-ok",
  tint: "bg-ok/[0.05]",
  chipOn: "border-ok bg-ok/15",
}
const CHECK: TraceStyle = {
  badge: "border-riskmed/50 bg-riskmed/10 text-riskmed",
  bar: "bg-riskmed",
  text: "text-riskmed",
  edge: "border-l-riskmed",
  tint: "bg-riskmed/[0.05]",
  chipOn: "border-riskmed bg-riskmed/15",
}
const QUESTION: TraceStyle = {
  badge: "border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  bar: "bg-sky-500",
  text: "text-sky-600 dark:text-sky-400",
  edge: "border-l-sky-500",
  tint: "bg-sky-500/[0.05]",
  chipOn: "border-sky-500 bg-sky-500/15",
}
const ACTION: TraceStyle = {
  badge: "border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  bar: "bg-violet-500",
  text: "text-violet-600 dark:text-violet-400",
  edge: "border-l-violet-500",
  tint: "bg-violet-500/[0.05]",
  chipOn: "border-violet-500 bg-violet-500/15",
}
const NOTE: TraceStyle = {
  badge: "border-pink-500/50 bg-pink-500/10 text-pink-600 dark:text-pink-400",
  bar: "bg-pink-500",
  text: "text-pink-600 dark:text-pink-400",
  edge: "border-l-pink-500",
  tint: "bg-pink-500/[0.05]",
  chipOn: "border-pink-500 bg-pink-500/15",
}
const UNKNOWN: TraceStyle = {
  badge: "border-border bg-muted text-muted-foreground",
  bar: "bg-muted-foreground/40",
  text: "text-muted-foreground",
  edge: "border-l-border",
  tint: "bg-muted/40",
  chipOn: "border-foreground/40 bg-muted",
}

const TRACE_STYLES: Record<string, TraceStyle> = {
  request: QUESTION,
  cognition: REASONING,
  action: ACTION,
  retrieval: RESEARCH,
  control: CHECK,
  memory: NOTE,
}

/** How a kind of trace step is drawn. A kind the API adds later is gray until it is given a style here. */
export function traceStyle(type: string): TraceStyle {
  return TRACE_STYLES[type] ?? UNKNOWN
}

/** Order the kinds appear in a turn's summary bar — roughly the order the AI works in. */
export const TRACE_TYPE_ORDER = ["request", "retrieval", "action", "cognition", "control", "memory"] as const

/** How many steps of each kind a turn has, in TRACE_TYPE_ORDER, with unknown kinds last. Kinds with
 * no steps are left out. */
export function countTraceTypes(events: Pick<TraceEvent, "type">[]): { type: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const event of events) counts.set(event.type, (counts.get(event.type) ?? 0) + 1)
  const known: readonly string[] = TRACE_TYPE_ORDER
  const ordered = [...known.filter((type) => counts.has(type)), ...[...counts.keys()].filter((type) => !known.includes(type))]
  return ordered.map((type) => ({ type, count: counts.get(type)! }))
}

/** The initial shown in a member's avatar; "?" for a removed member. */
export function memberInitial(name: string | null | undefined): string {
  return name?.trim().charAt(0).toUpperCase() || "?"
}

/** Everything a pane can run, chat first. Mirrors TRACE_SOURCES in ilovelawyer-api; the pane names
 * each one with the i18n key `traceSource_<source>` and lists them in this order in its filter. */
export const TRACE_SOURCE_ORDER = [
  "chat",
  "witnessExtract",
  "witnessScoring",
  "caseReconstruction",
  "caseScenes",
  "caseEvents",
  "redTeam",
  "caseStrategy",
  "caseTheory",
  "theoryDiff",
  "caseMindMap",
  "mindMap",
  "audioOverview",
  "damagesExtract",
  "citationGround",
  "claimExtract",
] as const

/** How many runs each source has, in TRACE_SOURCE_ORDER with unknown sources last. Sources with no
 * runs are left out. */
export function countSources(turns: Pick<TraceTurn, "source">[]): { source: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const turn of turns) counts.set(turn.source, (counts.get(turn.source) ?? 0) + 1)
  const known: readonly string[] = TRACE_SOURCE_ORDER
  const ordered = [...known.filter((source) => counts.has(source)), ...[...counts.keys()].filter((source) => !known.includes(source))]
  return ordered.map((source) => ({ source, count: counts.get(source)! }))
}

/** The runs matching a member and a source; an empty value means "any". */
export function filterTurns<T extends Pick<TraceTurn, "userId" | "source">>(turns: T[], filter: { memberId: string; source: string }): T[] {
  return turns.filter(
    (turn) => (filter.memberId === "" || turn.userId === filter.memberId) && (filter.source === "" || turn.source === filter.source),
  )
}

/** The entries of a turn that match the type filter; an empty value means "all". */
export function filterEvents<T extends Pick<TraceEvent, "type">>(events: T[], type: string): T[] {
  return type === "" ? events : events.filter((event) => event.type === type)
}
