import { PANEL_TITLES } from "@/lib/terminal/panel-titles";
import type { PanelId } from "@/lib/terminal/types";
import type { TenantCode } from "@/lib/tenant-code/resolve-host";

// The landing page's panel carousel — one card per pane a lawyer can actually add in the Legal
// Terminal (ilovelawyer-api's PANEL_CATALOG), named with the Terminal's own PANEL_TITLES. Left
// out on purpose: "dates" (folded into Evidence & Timeline, never its own pane). One exception:
// "AI Legal Response" (previewOnly) is a second look at the chat pane, not a pane of its own.

export const PANEL_CATEGORIES = ["facts", "law", "strategy", "risk", "team"] as const;
export type PanelCategory = (typeof PANEL_CATEGORIES)[number];

/** Tabs shown as a static grid of all their panels instead of the carousel. */
export const GRID_CATEGORIES: ReadonlySet<PanelCategory> = new Set(["facts", "law", "risk", "team"]);

export function isGridCategory(category: PanelCategory | "all"): boolean {
  return category !== "all" && GRID_CATEGORIES.has(category);
}

/** The cards with a hand-built miniature in TerminalMockWindow; every other pane renders
 * TerminalMockWindow's generic list layout from `terminal.samples`. */
export type DetailedMockKey = "caseSummary" | "evidenceTimeline" | "redTeam" | "chat" | "chatResponse";

export interface LandingPanel {
  id: PanelId;
  category: PanelCategory;
  detailedMock?: DetailedMockKey;
  /** A pane that only works on Philippine jurisprudence, shown to the PH tenant only. None today
   * (Citation Map was the one, and it was retired). */
  phOnly?: boolean;
  /** Key for this card's `terminal.cards` copy, when it isn't the pane id (two cards, one pane). */
  cardKey?: string;
  /** Card title, when it isn't the pane's PANEL_TITLES name. */
  title?: string;
  /** A second view of an existing pane — a card, but not one of the "{{count}} pane types". */
  previewOnly?: boolean;
}

const LANDING_PANELS: LandingPanel[] = [
  { id: "command", category: "facts", detailedMock: "caseSummary" },
  { id: "evidence", category: "facts", detailedMock: "evidenceTimeline" },
  { id: "witnesses", category: "facts" },
  { id: "caseReconstruction", category: "facts" },
  { id: "law", category: "law" },
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
  { id: "chat", category: "team", detailedMock: "chat" },
  {
    id: "chat",
    category: "team",
    detailedMock: "chatResponse",
    cardKey: "chatResponse",
    title: "AI Legal Response",
    previewOnly: true,
  },
];

export const PANEL_TEXTURES = [
  "/landing/textures/texture-dots.jpg",
  "/landing/textures/texture-gold.jpg",
  "/landing/textures/texture-blue.jpg",
  "/landing/textures/texture-teal.jpg",
];

export const cardKeyOf = (panel: LandingPanel): string => panel.cardKey ?? panel.id;
export const cardTitleOf = (panel: LandingPanel): string => panel.title ?? PANEL_TITLES[panel.id];

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
