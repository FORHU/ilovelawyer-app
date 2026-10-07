// The controls the page tours and "Ask the guide" can point at, and the guide's answers. Tours
// target elements by their `data-tour-id`, never by coordinates, so a layout change moves the
// spotlight with it. Copy lives in locales/<lang>/tour.json; this file only holds keys. The page
// tours themselves are in page-tours.ts.

import type { SampleTourTrack } from "@/lib/sample-case/tours"

export const CONSULTATION_PATH = "/homepage"
export const CASES_PATH = "/homepage/case-portfolio"
export const LIBRARY_PATH = "/homepage/library"
export const CALENDAR_PATH = "/homepage/calendar"

/** A control a tour or the guide can point at. `route` null means it's on every signed-in page
 * (the header). `fallback` is tried when the target isn't visible — e.g. a header tab that
 * lives behind the hamburger below lg. `alt` is an equivalent control tried first. */
export interface TourTarget {
  route: string | null
  fallback?: string
  alt?: string
}

const TARGETS = {
  "composer-input": { route: CONSULTATION_PATH },
  "composer-attach": { route: CONSULTATION_PATH },
  "composer-mic": { route: CONSULTATION_PATH },
  "consult-new": { route: CONSULTATION_PATH },
  "consult-history": { route: CONSULTATION_PATH },
  "nav-case-portfolio": { route: null, fallback: "header-menu" },
  "nav-calendar": { route: null, fallback: "header-menu" },
  "nav-library": { route: null, fallback: "header-menu" },
  "cases-create-first": { route: CASES_PATH, alt: "cases-new" },
  "cases-new": { route: CASES_PATH },
  "cases-search": { route: CASES_PATH },
  "cases-filters": { route: CASES_PATH },
  "case-row-terminal": { route: CASES_PATH },
  "case-row-workspace": { route: CASES_PATH },
  "header-account": { route: null, fallback: "header-menu" },
  "header-theme": { route: null, fallback: "header-menu" },
  "header-guide": { route: null, fallback: "header-menu" },
  "header-bell": { route: null, fallback: "header-menu" },
  "header-lang": { route: null, fallback: "header-menu" },
  "header-menu": { route: null },
  "library-search": { route: LIBRARY_PATH },
  "library-cats": { route: LIBRARY_PATH },
  "library-filters": { route: LIBRARY_PATH },
  "cal-add": { route: CALENDAR_PATH },
  "cal-grid": { route: CALENDAR_PATH },
  "cal-day": { route: CALENDAR_PATH },
} satisfies Record<string, TourTarget>

export type TourTargetId = keyof typeof TARGETS
export const TOUR_TARGETS: Record<TourTargetId, TourTarget> = TARGETS

export type Placement = "top" | "bottom" | "left" | "right"

/** Every route here is a whole page, matched exactly — "/homepage" (Consultation) must not
 * also match every other page under /homepage. null means any signed-in page. */
export function routeMatches(want: string | null | undefined, pathname: string) {
  return !want || pathname === want
}

// ── Prerequisites ───────────────────────────────────────────────────────────

/** Something the user must have before some controls exist at all — a case, for the case-row
 * buttons. Copy lives under `prerequisites.<id>` in tour.json. */
export type Prerequisite = "case"

/** `target` is the control that meets the prerequisite; `unlocks` are the controls that only
 * appear once it's met, so the guide must never point at them before then. */
export const PREREQUISITES: Record<Prerequisite, { target: TourTargetId; route: string; unlocks: TourTargetId[] }> = {
  case: { target: "cases-create-first", route: CASES_PATH, unlocks: ["case-row-workspace", "case-row-terminal"] },
}

/** Which prerequisites the user has met. One that's unknown (still loading) counts as met, so
 * the guide never sends someone off to create a case on a guess. */
export type MetPrerequisites = Partial<Record<Prerequisite, boolean>>

/** The prerequisite standing between the user and `target`, if any. */
export function missingPrerequisite(target: TourTargetId, met: MetPrerequisites): Prerequisite | null {
  for (const [id, prerequisite] of Object.entries(PREREQUISITES) as [Prerequisite, (typeof PREREQUISITES)[Prerequisite]][]) {
    if (met[id] === false && prerequisite.unlocks.includes(target)) return id
  }
  return null
}

// ── Ask the guide ───────────────────────────────────────────────────────────

/** A canned how-to answer: matched when the question contains any of `keys` (lowercase), it
 * answers with `answers.<id>` and can point at `target` on `route`. An answer whose target needs
 * a prerequisite also has `answers.<id>_blocked` (said before it's met) and `answers.<id>_next`
 * (said once it is), plus `path`: the steps to the feature, as keys under `prerequisites.steps`,
 * the first being the prerequisite's own. `sample` is the sample-case tour that shows the
 * feature without one. */
export interface GuideAnswer {
  id: string
  keys: string[]
  target: TourTargetId
  route: string | null
  topic: string
  path?: string[]
  sample?: SampleTourTrack
}

// Order matters: the first answer with a matching key wins, so narrower phrasings come first.
export const GUIDE_ANSWERS: GuideAnswer[] = [
  { id: "addEvent", keys: ["add event", "add a hearing", "new event", "add appointment", "add a note", "schedule a", "create an event"], target: "cal-add", route: CALENDAR_PATH, topic: "calendar" },
  { id: "reminder", keys: ["reminder", "notify", "email reminder", "alert me"], target: "cal-add", route: CALENDAR_PATH, topic: "calendar" },
  { id: "editEvent", keys: ["edit event", "delete event", "change an event", "reschedule", "move a hearing", "cancel a hearing"], target: "cal-day", route: CALENDAR_PATH, topic: "calendar" },
  { id: "month", keys: ["month view", "see my month", "what is scheduled", "overview of my month", "my schedule"], target: "cal-grid", route: CALENDAR_PATH, topic: "calendar" },
  { id: "libraryCategories", keys: ["republic act", "legislation", "case law", "switch to", "jurisprudence tab", "category"], target: "library-cats", route: LIBRARY_PATH, topic: "library" },
  { id: "libraryFilters", keys: ["filter decisions", "filter the library", "by court", "by topic", "narrow results", "filter results"], target: "library-filters", route: LIBRARY_PATH, topic: "library" },
  { id: "librarySearch", keys: ["search law", "search the library", "find a decision", "g.r. no", "search library"], target: "library-search", route: LIBRARY_PATH, topic: "library" },
  { id: "terminal", keys: ["terminal", "pane", "grid"], target: "case-row-terminal", route: CASES_PATH, topic: "casePortfolio", path: ["createCase", "openTerminal"], sample: "terminal" },
  { id: "workspace", keys: ["workspace", "sources", "studio", "audio overview", "case brief", "mind map"], target: "case-row-workspace", route: CASES_PATH, topic: "workspace", path: ["createCase", "addDocuments", "openStudio"], sample: "studio" },
  { id: "findCase", keys: ["search case", "find a case", "find case", "look up a case"], target: "cases-search", route: CASES_PATH, topic: "casePortfolio" },
  { id: "statusFilter", keys: ["archive", "archived", "closed case"], target: "cases-filters", route: CASES_PATH, topic: "casePortfolio" },
  { id: "newCase", keys: ["new case", "create a case", "filing", "add a case", "start a case"], target: "cases-new", route: CASES_PATH, topic: "casePortfolio" },
  { id: "upload", keys: ["upload", "attach", "document", "file", "pdf"], target: "composer-attach", route: CONSULTATION_PATH, topic: "consultation" },
  { id: "voice", keys: ["voice", "dictat", "microphone", "speak"], target: "composer-mic", route: CONSULTATION_PATH, topic: "consultation" },
  { id: "newConsultation", keys: ["new consultation", "new chat", "fresh chat"], target: "consult-new", route: CONSULTATION_PATH, topic: "consultation" },
  { id: "history", keys: ["history", "past consultation", "previous chat", "old chat"], target: "consult-history", route: CONSULTATION_PATH, topic: "consultation" },
  { id: "calendar", keys: ["calendar", "hearing", "schedule", "deadline", "appointment"], target: "nav-calendar", route: null, topic: "calendar" },
  { id: "team", keys: ["invite", "team", "member", "organization", "colleague"], target: "header-account", route: null, topic: "organization" },
  { id: "profile", keys: ["profile", "password", "username", "my account"], target: "header-account", route: null, topic: "profile" },
  { id: "theme", keys: ["dark", "light", "theme"], target: "header-theme", route: null, topic: "settings" },
  { id: "language", keys: ["language", "tagalog", "korean", "filipino"], target: "header-lang", route: null, topic: "settings" },
  { id: "notifications", keys: ["notification", "alert", "bell"], target: "header-bell", route: null, topic: "notifications" },
  { id: "tour", keys: ["tour", "onboarding", "walkthrough"], target: "header-guide", route: null, topic: "tour" },
  { id: "library", keys: ["codal", "library", "jurisprudence", "penal code", "civil code", "constitution"], target: "nav-library", route: null, topic: "library" },
]

/** Phrases that mark a question about the law rather than about the app — those are handed to
 * Consultation, where answers carry citations, unless a how-to answer also matches. */
export const LEGAL_SIGNALS = [
  "can my client", "is it legal", "liable", "prescri", "file for", "illegal dismissal", "estafa", "rights",
  "sue", "penalty", "annul", "evict", "damages", "is it allowed", "under the law",
]

/** Suggested questions (keys under `suggestions.*`), page-specific ones first. */
export const GUIDE_SUGGESTIONS_BY_ROUTE: Record<string, string[]> = {
  [LIBRARY_PATH]: ["searchLibrary", "filterLibrary", "switchCategory"],
  [CALENDAR_PATH]: ["addHearing", "reminder", "editEvent"],
  [CASES_PATH]: ["findCase", "workspace", "openTerminal", "archived"],
  [CONSULTATION_PATH]: ["dictate", "newConsultation", "upload"],
}

export const GUIDE_SUGGESTIONS = [
  "addHearing", "openTerminal", "upload", "invite", "newConsultation", "dictate", "findCase",
  "workspace", "notifications", "searchLibrary", "theme", "language",
]

export type GuideMatch =
  | { kind: "answer"; answer: GuideAnswer }
  /** The answer points at a control the user can't reach yet — see PREREQUISITES. */
  | { kind: "blocked"; answer: GuideAnswer; missing: Prerequisite }
  | { kind: "legal" }
  | { kind: "none" }

export function matchGuideAnswer(question: string, met: MetPrerequisites = {}): GuideMatch {
  const q = question.toLowerCase()
  const answer = GUIDE_ANSWERS.find((a) => a.keys.some((k) => q.includes(k)))
  if (answer) {
    const missing = missingPrerequisite(answer.target, met)
    return missing ? { kind: "blocked", answer, missing } : { kind: "answer", answer }
  }
  if (LEGAL_SIGNALS.some((k) => q.includes(k))) return { kind: "legal" }
  return { kind: "none" }
}

export type GuidePathStep = { key: string; state: "done" | "now" | "later" }

/** An answer's steps to its feature, marked off: before the prerequisite is met the first step is
 * the one to do; once it is, the second. */
export function guidePath(answer: GuideAnswer, prerequisiteMet: boolean): GuidePathStep[] | undefined {
  const now = prerequisiteMet ? 1 : 0
  return answer.path?.map((key, i) => ({ key, state: i < now ? "done" : i === now ? "now" : "later" }))
}
