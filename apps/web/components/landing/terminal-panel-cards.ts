import type { PanelId } from "@/lib/terminal/types";
import type { TenantCode } from "@/lib/tenant-code/resolve-host";

// The landing page's panel carousel — one card per pane a lawyer can actually add in the Legal
// Terminal (ilovelawyer-api's PANEL_CATALOG), named with the Terminal's own PANEL_TITLES. Left
// out on purpose: "dates" (folded into Evidence & Timeline, never its own pane) and
// "verification" (renders nothing until the API's USE_GROUNDING_VERIFIER flag is on).

export const PANEL_CATEGORIES = ["facts", "law", "strategy", "risk", "team"] as const;
export type PanelCategory = (typeof PANEL_CATEGORIES)[number];

/** The four panes with a hand-built miniature in TerminalMockWindow; every other pane renders
 * TerminalMockWindow's generic list layout from `terminal.samples`. */
export type DetailedMockKey = "caseSummary" | "evidenceTimeline" | "redTeam" | "chat";

export interface LandingPanel {
  id: PanelId;
  category: PanelCategory;
  detailedMock?: DetailedMockKey;
  /** Citation Map only works on Philippine jurisprudence (see its catalog description). */
  phOnly?: boolean;
}

const LANDING_PANELS: LandingPanel[] = [
  { id: "command", category: "facts", detailedMock: "caseSummary" },
  { id: "evidence", category: "facts", detailedMock: "evidenceTimeline" },
  { id: "contradictions", category: "facts" },
  { id: "witnesses", category: "facts" },
  { id: "caseReconstruction", category: "facts" },
  { id: "law", category: "law" },
  { id: "citationMap", category: "law", phOnly: true },
  { id: "legalIssues", category: "law" },
  { id: "decisions", category: "law" },
  { id: "procedure", category: "strategy" },
  { id: "mindMap", category: "strategy" },
  { id: "attackStrategy", category: "strategy" },
  { id: "defenseStrategy", category: "strategy" },
  { id: "theories", category: "strategy" },
  { id: "audioOverview", category: "strategy" },
  { id: "redTeam", category: "risk", detailedMock: "redTeam" },
  { id: "weaknesses", category: "risk" },
  { id: "strengths", category: "risk" },
  { id: "damages", category: "risk" },
  { id: "teamAudit", category: "team" },
  { id: "chat", category: "team", detailedMock: "chat" },
];

export const PANEL_TEXTURES = [
  "/landing/textures/texture-dots.jpg",
  "/landing/textures/texture-gold.jpg",
  "/landing/textures/texture-blue.jpg",
  "/landing/textures/texture-teal.jpg",
];

export function panelsForTenant(tenantCode: TenantCode): LandingPanel[] {
  return LANDING_PANELS.filter((p) => !p.phOnly || tenantCode === "PH");
}

/** "All" interleaves the categories (one Facts, one Law, one Strategy…) so the strip doesn't
 * run five Facts cards in a row before anything else appears — same order as the handoff. */
export function orderForCategory(panels: LandingPanel[], category: PanelCategory | "all"): LandingPanel[] {
  if (category !== "all") return panels.filter((p) => p.category === category);
  const queues = PANEL_CATEGORIES.map((c) => panels.filter((p) => p.category === c));
  const out: LandingPanel[] = [];
  while (queues.some((q) => q.length)) queues.forEach((q) => q.length && out.push(q.shift()!));
  return out;
}
