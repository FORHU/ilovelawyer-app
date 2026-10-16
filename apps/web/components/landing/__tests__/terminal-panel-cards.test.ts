import { describe, expect, it } from "vitest";
import {
  cardKeyOf,
  cardTitleOf,
  isGridCategory,
  orderForCategory,
  panelsForTenant,
} from "@/components/landing/terminal-panel-cards";

describe("isGridCategory", () => {
  it("shows the Facts, Law, Risk and Team tabs as a grid", () => {
    expect(["facts", "law", "risk", "team"].map((c) => isGridCategory(c as never))).toEqual([true, true, true, true]);
  });

  it("keeps the carousel for All and Strategy", () => {
    expect(isGridCategory("all")).toBe(false);
    expect(isGridCategory("strategy")).toBe(false);
  });
});

describe("landing panels", () => {
  const panels = panelsForTenant("UK");

  it("gives every card a unique key", () => {
    const keys = panels.map(cardKeyOf);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("puts the AI Legal Assistant and AI Legal Response cards under Team", () => {
    expect(orderForCategory(panels, "team").map(cardTitleOf)).toEqual(["AI Legal Assistant", "AI Legal Response"]);
  });

  it("counts only real panes, not preview cards", () => {
    expect(panels.filter((p) => !p.previewOnly)).toHaveLength(18);
  });

  it("still includes every card once in All", () => {
    const all = orderForCategory(panels, "all");
    expect(all).toHaveLength(panels.length);
    expect(new Set(all.map(cardKeyOf)).size).toBe(panels.length);
  });
});
