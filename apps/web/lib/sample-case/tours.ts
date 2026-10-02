import type { Placement } from "@/lib/tour/steps"

export type SampleView = "workspace" | "terminal"
export type SampleTourTrack = "studio" | "terminal"
export type SampleTile = "audio" | "mindmap" | "timeline" | "datatable" | "decisions" | "brief"

/** A step of a sample-case tour. `target` is a `data-sample-tour` value on the sample page;
 * `tile` opens that Studio tile first so the step can show its output. Copy lives under
 * `sampleCase.tour.<track>.steps.<id>` in tour.json. */
export interface SampleTourStep {
  id: string
  view: SampleView
  target: string
  placement: Placement
  tile?: SampleTile
}

export const SAMPLE_TILES: SampleTile[] = ["audio", "mindmap", "timeline", "datatable", "decisions", "brief"]

export const SAMPLE_TOURS: Record<SampleTourTrack, SampleTourStep[]> = {
  studio: [
    { id: "sources", view: "workspace", target: "sources", placement: "right" },
    { id: "chat", view: "workspace", target: "chat", placement: "left" },
    { id: "tiles", view: "workspace", target: "tiles", placement: "left" },
    ...SAMPLE_TILES.map((tile): SampleTourStep => ({ id: tile, view: "workspace", target: "studio", placement: "left", tile })),
  ],
  terminal: [
    { id: "nextdate", view: "terminal", target: "nextdate", placement: "bottom" },
    { id: "command", view: "terminal", target: "pane-command", placement: "right" },
    { id: "evidence", view: "terminal", target: "pane-evidence", placement: "left" },
    { id: "contradictions", view: "terminal", target: "pane-contradictions", placement: "left" },
    { id: "law", view: "terminal", target: "pane-law", placement: "right" },
    { id: "legalIssues", view: "terminal", target: "pane-legalIssues", placement: "left" },
    { id: "procedure", view: "terminal", target: "pane-procedure", placement: "left" },
    { id: "redTeam", view: "terminal", target: "pane-redTeam", placement: "right" },
    { id: "addPane", view: "terminal", target: "add-pane", placement: "bottom" },
    { id: "arrange", view: "terminal", target: "arrange", placement: "bottom" },
  ],
}

export const SAMPLE_CASE_PATH = "/homepage/sample-case"

/** The sample page for a tour, remembering which case to send the user back to. */
export function sampleCaseHref(track: SampleTourTrack, from?: string) {
  const params = new URLSearchParams({ view: track === "studio" ? "workspace" : "terminal", tour: track })
  if (from) params.set("from", from)
  return `${SAMPLE_CASE_PATH}?${params}`
}

/** The `?from=` path for "Back to your case" — only a path inside the signed-in app, so a crafted
 * link can't send the button to another site. */
export function safeReturnPath(from: string | null) {
  return from && from.startsWith("/homepage/") && !from.includes("//") && !from.includes("\\") ? from : null
}
