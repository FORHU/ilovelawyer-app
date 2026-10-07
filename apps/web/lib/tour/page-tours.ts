import { CALENDAR_PATH, CASES_PATH, CONSULTATION_PATH, LIBRARY_PATH, type Placement, type TourTargetId } from "@/lib/tour/steps"
import { SAMPLE_CASE_PATH, type SampleTourTrack } from "@/lib/sample-case/tours"

/** A stop on a page tour: a control on the current page. Its title is `targets.<target>` and
 * its body `pageTour.steps.<target>` in tour.json. */
export interface PageTourStep {
  target: TourTargetId
  placement: Placement
}

/** The pages with their own tour — each is also its saved progress track on the API (see
 * PRODUCT_TOUR_TRACKS in ilovelawyer-api), so it runs once, on the user's first visit. */
export type PageTourTrack = "consultation" | "cases" | "library" | "calendar"

export interface PageTour {
  track: PageTourTrack
  steps: PageTourStep[]
}

/** A look-only walkthrough of one page's own controls. It runs on the user's first visit to the
 * page and any time after from "Tour this page" in Ask the guide. A step whose control isn't on
 * screen (no cases yet, or a desktop-only control on a phone) is left out. */
export const PAGE_TOURS: Record<string, PageTour> = {
  [CONSULTATION_PATH]: {
    track: "consultation",
    steps: [
      { target: "composer-input", placement: "top" },
      { target: "composer-attach", placement: "top" },
      { target: "composer-mic", placement: "top" },
      { target: "consult-new", placement: "right" },
      { target: "consult-history", placement: "right" },
    ],
  },
  [CASES_PATH]: {
    track: "cases",
    steps: [
      { target: "cases-new", placement: "bottom" },
      { target: "cases-search", placement: "bottom" },
      { target: "cases-filters", placement: "bottom" },
      // Only there while the user has no cases — it says where Workspace and Terminal will be.
      { target: "cases-create-first", placement: "right" },
      { target: "case-row-workspace", placement: "left" },
      { target: "case-row-terminal", placement: "left" },
    ],
  },
  [LIBRARY_PATH]: {
    track: "library",
    steps: [
      { target: "library-search", placement: "bottom" },
      { target: "library-cats", placement: "bottom" },
      { target: "library-filters", placement: "bottom" },
    ],
  },
  [CALENDAR_PATH]: {
    track: "calendar",
    steps: [
      { target: "cal-grid", placement: "right" },
      { target: "cal-day", placement: "left" },
      { target: "cal-add", placement: "left" },
    ],
  },
}

export type PageGuide =
  /** A walkthrough of this page's own controls. */
  | ({ kind: "page" } & PageTour)
  /** A case's Workspace or Terminal: its tour runs on the sample case, then comes back here. */
  | { kind: "sample"; track: SampleTourTrack }
  /** The sample case itself: run the tour for the tab being viewed. */
  | { kind: "sample-here" }

const CASE_WORKSPACE = /^\/homepage\/case-portfolio\/[^/]+$/
const CASE_TERMINAL = /^\/homepage\/terminal\/[^/]+$/

/** The tour for `pathname`, or null for a page without one. */
export function pageGuideFor(pathname: string): PageGuide | null {
  if (pathname === SAMPLE_CASE_PATH) return { kind: "sample-here" }
  if (CASE_WORKSPACE.test(pathname)) return { kind: "sample", track: "studio" }
  if (CASE_TERMINAL.test(pathname)) return { kind: "sample", track: "terminal" }
  const tour = PAGE_TOURS[pathname]
  return tour ? { kind: "page", ...tour } : null
}
